import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isUUID } from "class-validator";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { createInventoryDocumentNumber, inventoryTransactionOptions, lockActiveProduct } from "../inventory/inventory.utils.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";
import type { ReconcileInventoryDto, ReturnInDto, ReturnOutDto, ReverseTransactionDto, StockAdjustmentDto } from "./dto/inventory-operation.dto.js";

const operationInclude = {
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
  supplier: { select: { id: true, name: true } },
} as const;

type OperationTransaction = Prisma.InventoryTransactionGetPayload<{ include: typeof operationInclude }>;
type ReconciliationRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  productQuantity: Prisma.Decimal;
  ledgerQuantity: Prisma.Decimal;
};

@Injectable()
export class InventoryOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async adjust(input: StockAdjustmentDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedAdjustment(input, user, requestKey);
    if (repeated) return this.toResponse(repeated);

    try {
      return await this.withCacheInvalidation(() => this.prisma.$transaction(async (tx) => {
        const product = await lockActiveProduct(tx, input.productId);
        const before = product.quantity;
        const after = new Prisma.Decimal(input.countedQuantity);
        const difference = after.minus(before);
        if (difference.isZero()) throw new BadRequestException("Counted quantity is already equal to available stock.");

        const transaction = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("ADJ"),
            type: "ADJUSTMENT",
            referenceNumber: input.reason.trim(),
            notes: input.notes,
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: {
              create: {
                productId: input.productId,
                quantity: difference.abs(),
                unitCost: product.averageCost,
                quantityBefore: before,
                quantityAfter: after,
              },
            },
          },
          include: operationInclude,
        });
        await tx.product.update({ where: { id: input.productId }, data: { quantity: after } });
        await this.notifications.syncProductAlerts(input.productId, tx);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "STOCK_ADJUSTED",
            entityType: "INVENTORY_TRANSACTION",
            entityId: transaction.id,
            metadata: { productId: input.productId, before: Number(before), after: Number(after), reason: input.reason },
          },
        });
        return this.toResponse(transaction);
      }, inventoryTransactionOptions()));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const repeatedAfterConflict = await this.findRepeatedAdjustment(input, user, requestKey);
        if (repeatedAfterConflict) return this.toResponse(repeatedAfterConflict);
      }
      throw error;
    }
  }

  async reverse(transactionId: string, input: ReverseTransactionDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedReversal(transactionId, input, user, requestKey);
    if (repeated) return this.toResponse(repeated);

    try {
      return await this.withCacheInvalidation(() => this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string; status: "CONFIRMED" | "REVERSED" }>>`
          SELECT id, status
          FROM inventory_transactions
          WHERE id = ${transactionId}::uuid
          FOR UPDATE
        `;
        if (!locked[0]) throw new BadRequestException("Inventory transaction was not found.");
        if (locked[0].status === "REVERSED") throw new ConflictException("Inventory transaction is already reversed.");

        const original = await tx.inventoryTransaction.findUniqueOrThrow({
          where: { id: transactionId },
          include: operationInclude,
        });
        if (original.type === "REVERSAL") throw new BadRequestException("A reversal transaction cannot be reversed.");

        const reversalItems: Array<{
          productId: string;
          quantity: Prisma.Decimal;
          unitCost: Prisma.Decimal;
          quantityBefore: Prisma.Decimal;
          quantityAfter: Prisma.Decimal;
        }> = [];
        const affectedProductIds: string[] = [];
        for (const item of [...original.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
          const product = await lockActiveProduct(tx, item.productId);
          const originalDifference = item.quantityAfter.minus(item.quantityBefore);
          const reversalDifference = originalDifference.negated();
          const after = product.quantity.plus(reversalDifference);
          if (after.lt(0)) {
            throw new BadRequestException(`Reversal would make stock negative for ${item.product.name}.`);
          }

          let averageCost = product.averageCost;
          if (reversalDifference.gt(0)) {
            const restoredValue = reversalDifference.mul(item.unitCost);
            averageCost = after.isZero()
              ? new Prisma.Decimal(0)
              : product.quantity.mul(product.averageCost).plus(restoredValue).div(after);
          } else if (after.isZero()) {
            averageCost = new Prisma.Decimal(0);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: after, averageCost },
          });
          affectedProductIds.push(item.productId);
          reversalItems.push({
            productId: item.productId,
            quantity: reversalDifference.abs(),
            unitCost: item.unitCost,
            quantityBefore: product.quantity,
            quantityAfter: after,
          });
        }
        for (const productId of affectedProductIds) {
          await this.notifications.syncProductAlerts(productId, tx);
        }

        await tx.inventoryTransaction.update({
          where: { id: original.id },
          data: { status: "REVERSED" },
        });
        const reversal = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("REV"),
            type: "REVERSAL",
            referenceNumber: original.documentNumber,
            notes: input.reason.trim(),
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: { create: reversalItems },
          },
          include: operationInclude,
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "INVENTORY_TRANSACTION_REVERSED",
            entityType: "INVENTORY_TRANSACTION",
            entityId: original.id,
            metadata: { reversalId: reversal.id, reversalDocument: reversal.documentNumber, reason: input.reason },
          },
        });
        return this.toResponse(reversal);
      }, inventoryTransactionOptions()));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const repeatedAfterConflict = await this.findRepeatedReversal(transactionId, input, user, requestKey);
        if (repeatedAfterConflict) return this.toResponse(repeatedAfterConflict);
      }
      throw error;
    }
  }

  async returnIn(input: ReturnInDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedReturn("RETURN_IN", input, user, requestKey);
    if (repeated) return this.toResponse(repeated);

    try {
      return await this.withCacheInvalidation(() => this.prisma.$transaction(async (tx) => {
        const product = await lockActiveProduct(tx, input.productId);
        const quantity = new Prisma.Decimal(input.quantity);
        const after = product.quantity.plus(quantity);
        const unitCost = product.averageCost.gt(0) ? product.averageCost : product.costPrice;
        const transaction = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("RTI"),
            type: "RETURN_IN",
            department: input.department.trim(),
            receiver: input.receiver.trim(),
            referenceNumber: input.referenceNumber?.trim(),
            notes: input.notes,
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: { create: { productId: input.productId, quantity, unitCost, quantityBefore: product.quantity, quantityAfter: after } },
          },
          include: operationInclude,
        });
        await tx.product.update({ where: { id: input.productId }, data: { quantity: after, averageCost: unitCost } });
        await this.notifications.syncProductAlerts(input.productId, tx);
        await this.auditOperation(tx, user.id, "RETURN_IN_RECORDED", transaction.id, input.productId, input.quantity);
        return this.toResponse(transaction);
      }, inventoryTransactionOptions()));
    } catch (error) {
      return this.resolveRepeatedReturn(error, "RETURN_IN", input, user, requestKey);
    }
  }

  async returnOut(input: ReturnOutDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedReturn("RETURN_OUT", input, user, requestKey);
    if (repeated) return this.toResponse(repeated);

    try {
      return await this.withCacheInvalidation(() => this.prisma.$transaction(async (tx) => {
        const product = await lockActiveProduct(tx, input.productId);
        const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, status: "ACTIVE" } });
        if (!supplier) throw new BadRequestException("Supplier was not found or inactive.");
        const quantity = new Prisma.Decimal(input.quantity);
        if (product.quantity.lt(quantity)) throw new BadRequestException("Available stock is not enough for this return.");
        const after = product.quantity.minus(quantity);
        const transaction = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("RTO"),
            type: "RETURN_OUT",
            supplierId: input.supplierId,
            referenceNumber: input.referenceNumber?.trim(),
            notes: input.notes,
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: { create: { productId: input.productId, quantity, unitCost: product.averageCost, quantityBefore: product.quantity, quantityAfter: after } },
          },
          include: operationInclude,
        });
        await tx.product.update({ where: { id: input.productId }, data: { quantity: after } });
        await this.notifications.syncProductAlerts(input.productId, tx);
        await this.auditOperation(tx, user.id, "RETURN_OUT_RECORDED", transaction.id, input.productId, input.quantity);
        return this.toResponse(transaction);
      }, inventoryTransactionOptions()));
    } catch (error) {
      return this.resolveRepeatedReturn(error, "RETURN_OUT", input, user, requestKey);
    }
  }

  async reconciliation() {
    const rows = await this.prisma.$queryRaw<ReconciliationRow[]>`
      SELECT
        p.id AS "productId",
        p.sku,
        p.name,
        p.unit,
        p.quantity AS "productQuantity",
        COALESCE(SUM(i.quantity_after - i.quantity_before), 0) AS "ledgerQuantity"
      FROM products p
      LEFT JOIN inventory_transaction_items i ON i.product_id = p.id
      WHERE p.status <> 'ARCHIVED'
      GROUP BY p.id, p.sku, p.name, p.unit, p.quantity
      ORDER BY p.name
    `;
    const items = rows.map((row) => {
      const productQuantity = Number(row.productQuantity);
      const ledgerQuantity = Number(row.ledgerQuantity);
      const difference = productQuantity - ledgerQuantity;
      return {
        productId: row.productId,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        productQuantity,
        ledgerQuantity,
        difference,
        status: Math.abs(difference) < 0.0001 ? "MATCH" : "MISMATCH",
      };
    });
    return {
      items,
      summary: {
        total: items.length,
        matched: items.filter((item) => item.status === "MATCH").length,
        mismatched: items.filter((item) => item.status === "MISMATCH").length,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async repairReconciliation(productId: string, input: ReconcileInventoryDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const existing = await this.prisma.inventoryTransaction.findUnique({ where: { requestKey }, include: operationInclude });
    if (existing) {
      if (existing.type !== "ADJUSTMENT" || existing.createdById !== user.id || existing.items[0]?.productId !== productId) {
        throw new ConflictException("Idempotency key was already used for a different inventory operation.");
      }
      return this.toResponse(existing);
    }

    return this.withCacheInvalidation(() => this.prisma.$transaction(async (tx) => {
      const product = await lockActiveProduct(tx, productId);
      const ledgerRows = await tx.$queryRaw<Array<{ quantity: Prisma.Decimal }>>`
        SELECT COALESCE(SUM(i.quantity_after - i.quantity_before), 0) AS quantity
        FROM inventory_transaction_items i
        WHERE i.product_id = ${productId}::uuid
      `;
      const ledgerQuantity = ledgerRows[0]?.quantity ?? new Prisma.Decimal(0);
      const difference = product.quantity.minus(ledgerQuantity);
      if (difference.isZero()) throw new BadRequestException("Inventory ledger already matches product quantity.");

      const transaction = await tx.inventoryTransaction.create({
        data: {
          requestKey,
          documentNumber: createInventoryDocumentNumber("ADJ"),
          type: "ADJUSTMENT",
          referenceNumber: "RECONCILIATION",
          notes: input.reason.trim(),
          transactionDate: new Date(input.date),
          createdById: user.id,
          items: {
            create: {
              productId,
              quantity: difference.abs(),
              unitCost: product.averageCost,
              quantityBefore: ledgerQuantity,
              quantityAfter: product.quantity,
            },
          },
        },
        include: operationInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "INVENTORY_RECONCILED",
          entityType: "INVENTORY_TRANSACTION",
          entityId: transaction.id,
          metadata: { productId, ledgerQuantity: Number(ledgerQuantity), productQuantity: Number(product.quantity), reason: input.reason },
        },
      });
      return this.toResponse(transaction);
    }, inventoryTransactionOptions()));
  }

  private async findRepeatedAdjustment(input: StockAdjustmentDto, user: AuthUser, requestKey: string) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({
      where: { requestKey },
      include: operationInclude,
    });
    if (!transaction) return null;
    const item = transaction.items[0];
    const same = transaction.type === "ADJUSTMENT" &&
      transaction.createdById === user.id &&
      transaction.referenceNumber === input.reason.trim() &&
      transaction.transactionDate.getTime() === new Date(input.date).getTime() &&
      item?.productId === input.productId &&
      item.quantityAfter.equals(input.countedQuantity);
    if (!same) throw new ConflictException("Idempotency key was already used for a different inventory operation.");
    return transaction;
  }

  private async withCacheInvalidation<T>(operation: () => Promise<T>) {
    const result = await operation();
    this.cache.invalidateInventoryReads();
    return result;
  }

  private async findRepeatedReversal(transactionId: string, input: ReverseTransactionDto, user: AuthUser, requestKey: string) {
    const [existing, original] = await Promise.all([
      this.prisma.inventoryTransaction.findUnique({ where: { requestKey }, include: operationInclude }),
      this.prisma.inventoryTransaction.findUnique({ where: { id: transactionId }, select: { documentNumber: true } }),
    ]);
    if (!existing) return null;
    const same = Boolean(original) &&
      existing.type === "REVERSAL" &&
      existing.createdById === user.id &&
      existing.referenceNumber === original?.documentNumber &&
      existing.notes === input.reason.trim() &&
      existing.transactionDate.getTime() === new Date(input.date).getTime();
    if (!same) throw new ConflictException("Idempotency key was already used for a different inventory operation.");
    return existing;
  }

  private async resolveRepeatedReturn(
    error: unknown,
    type: "RETURN_IN" | "RETURN_OUT",
    input: ReturnInDto | ReturnOutDto,
    user: AuthUser,
    requestKey: string,
  ) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await this.findRepeatedReturn(type, input, user, requestKey);
      if (repeated) return this.toResponse(repeated);
    }
    throw error;
  }

  private async findRepeatedReturn(
    type: "RETURN_IN" | "RETURN_OUT",
    input: ReturnInDto | ReturnOutDto,
    user: AuthUser,
    requestKey: string,
  ) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({ where: { requestKey }, include: operationInclude });
    if (!transaction) return null;
    const item = transaction.items[0];
    const sameBase = transaction.type === type &&
      transaction.createdById === user.id &&
      transaction.transactionDate.getTime() === new Date(input.date).getTime() &&
      (transaction.referenceNumber ?? "") === (input.referenceNumber?.trim() ?? "") &&
      item?.productId === input.productId &&
      item.quantity.equals(input.quantity);
    const sameDetails = type === "RETURN_IN"
      ? transaction.department === (input as ReturnInDto).department.trim() && transaction.receiver === (input as ReturnInDto).receiver.trim()
      : transaction.supplierId === (input as ReturnOutDto).supplierId;
    if (!sameBase || !sameDetails) throw new ConflictException("Idempotency key was already used for a different inventory operation.");
    return transaction;
  }

  private async auditOperation(
    tx: Prisma.TransactionClient,
    userId: string,
    action: string,
    transactionId: string,
    productId: string,
    quantity: number,
  ) {
    await tx.auditLog.create({
      data: { userId, action, entityType: "INVENTORY_TRANSACTION", entityId: transactionId, metadata: { productId, quantity } },
    });
  }

  private validateRequestKey(requestKey: string) {
    if (!isUUID(requestKey, "4")) throw new BadRequestException("A valid Idempotency-Key header is required.");
  }

  private toResponse(transaction: OperationTransaction) {
    const item = transaction.items[0];
    return {
      id: transaction.id,
      documentNumber: transaction.documentNumber,
      type: transaction.type,
      status: transaction.status,
      referenceNumber: transaction.referenceNumber,
      product: item?.product ?? null,
      quantity: item ? Number(item.quantity) : 0,
      unitCost: item ? Number(item.unitCost) : 0,
      quantityBefore: item ? Number(item.quantityBefore) : 0,
      quantityAfter: item ? Number(item.quantityAfter) : 0,
      transactionDate: transaction.transactionDate.toISOString(),
    };
  }
}
