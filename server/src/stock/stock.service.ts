import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isUUID } from "class-validator";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { createInventoryDocumentNumber, inventoryTransactionOptions, lockActiveProduct } from "../inventory/inventory.utils.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { StockInDto, StockOutDto } from "./dto/stock.dto.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";

const transactionInclude = {
  items: { include: { product: true } },
  supplier: true,
} as const;

type TransactionWithDetails = Prisma.InventoryTransactionGetPayload<{
  include: typeof transactionInclude;
}>;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async stockIn(input: StockInDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedRequest(requestKey, "STOCK_IN", input, user);
    if (repeated) return this.toResponse(repeated);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const product = await lockActiveProduct(tx, input.productId);
        const supplier = await tx.supplier.findFirst({
          where: { id: input.supplierId, status: "ACTIVE" },
        });
        if (!supplier) throw new NotFoundException("Supplier not found or inactive.");

        const quantity = new Prisma.Decimal(input.quantity);
        const costPrice = new Prisma.Decimal(input.costPrice);
        const before = product.quantity;
        const after = before.plus(quantity);
        const receivedValue = quantity.mul(costPrice);
        const averageCost = after.isZero()
          ? costPrice
          : before.mul(product.averageCost).plus(receivedValue).div(after);

        const transaction = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("SI"),
            type: "STOCK_IN",
            supplierId: input.supplierId,
            referenceNumber: input.referenceNumber?.trim(),
            notes: input.notes,
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: {
              create: {
                productId: input.productId,
                quantity,
                unitCost: costPrice,
                quantityBefore: before,
                quantityAfter: after,
              },
            },
          },
          include: transactionInclude,
        });

        await tx.stockIn.create({
          data: {
            transactionId: transaction.id,
            productId: input.productId,
            supplierId: input.supplierId,
            quantity,
            costPrice,
            quantityBefore: before,
            quantityAfter: after,
            date: new Date(input.date),
            notes: input.notes,
            createdById: user.id,
          },
        });
        await tx.product.update({
          where: { id: input.productId },
          data: { quantity: after, costPrice, averageCost },
        });
        await this.notifications.syncProductAlerts(input.productId, tx);
        await tx.productSupplier.upsert({
          where: {
            productId_supplierId: {
              productId: input.productId,
              supplierId: input.supplierId,
            },
          },
          update: { isPrimary: true },
          create: {
            productId: input.productId,
            supplierId: input.supplierId,
            isPrimary: true,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "STOCK_IN_RECORDED",
            entityType: "INVENTORY_TRANSACTION",
            entityId: transaction.id,
            metadata: { productId: input.productId, quantity: input.quantity, requestKey },
          },
        });
        return this.toResponse(transaction);
      }, inventoryTransactionOptions());
      this.invalidateReadCaches();
      return result;
    } catch (error) {
      return this.resolveRepeatedRequest(error, requestKey, "STOCK_IN", input, user);
    }
  }

  async stockOut(input: StockOutDto, user: AuthUser, requestKey: string) {
    this.validateRequestKey(requestKey);
    const repeated = await this.findRepeatedRequest(requestKey, "STOCK_OUT", input, user);
    if (repeated) return this.toResponse(repeated);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const product = await lockActiveProduct(tx, input.productId);
        const quantity = new Prisma.Decimal(input.quantity);
        const before = product.quantity;
        if (before.lt(quantity)) {
          throw new BadRequestException("Available stock is not enough for this stock out.");
        }
        const after = before.minus(quantity);

        const transaction = await tx.inventoryTransaction.create({
          data: {
            requestKey,
            documentNumber: createInventoryDocumentNumber("SO"),
            type: "STOCK_OUT",
            department: input.department,
            receiver: input.receiver,
            referenceNumber: input.referenceNumber?.trim(),
            notes: input.notes,
            transactionDate: new Date(input.date),
            createdById: user.id,
            items: {
              create: {
                productId: input.productId,
                quantity,
                unitCost: product.averageCost,
                quantityBefore: before,
                quantityAfter: after,
              },
            },
          },
          include: transactionInclude,
        });
        await tx.stockOut.create({
          data: {
            transactionId: transaction.id,
            productId: input.productId,
            quantity,
            unitCost: product.averageCost,
            quantityBefore: before,
            quantityAfter: after,
            department: input.department,
            receiver: input.receiver,
            date: new Date(input.date),
            notes: input.notes,
            createdById: user.id,
          },
        });
        await tx.product.update({
          where: { id: input.productId },
          data: { quantity: after },
        });
        await this.notifications.syncProductAlerts(input.productId, tx);
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "STOCK_OUT_RECORDED",
            entityType: "INVENTORY_TRANSACTION",
            entityId: transaction.id,
            metadata: { productId: input.productId, quantity: input.quantity, requestKey },
          },
        });
        return this.toResponse(transaction);
      }, inventoryTransactionOptions());
      this.invalidateReadCaches();
      return result;
    } catch (error) {
      return this.resolveRepeatedRequest(error, requestKey, "STOCK_OUT", input, user);
    }
  }

  private async resolveRepeatedRequest(
    error: unknown,
    requestKey: string,
    type: "STOCK_IN" | "STOCK_OUT",
    input: StockInDto | StockOutDto,
    user: AuthUser,
  ) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await this.findRepeatedRequest(requestKey, type, input, user);
      if (repeated) return this.toResponse(repeated);
    }
    throw error;
  }

  private async findRepeatedRequest(
    requestKey: string,
    type: "STOCK_IN" | "STOCK_OUT",
    input: StockInDto | StockOutDto,
    user: AuthUser,
  ) {
    const transaction = await this.prisma.inventoryTransaction.findUnique({
      where: { requestKey },
      include: transactionInclude,
    });
    if (!transaction) return null;

    const item = transaction.items[0];
    const sameBaseRequest =
      transaction.type === type &&
      transaction.createdById === user.id &&
      item?.productId === input.productId &&
      item.quantity.equals(input.quantity) &&
      transaction.transactionDate.getTime() === new Date(input.date).getTime() &&
      (transaction.referenceNumber ?? "") === (input.referenceNumber?.trim() ?? "") &&
      (transaction.notes ?? "") === (input.notes ?? "");
    const sameDetails = type === "STOCK_IN"
      ? transaction.supplierId === (input as StockInDto).supplierId &&
        item?.unitCost.equals((input as StockInDto).costPrice)
      : transaction.department === (input as StockOutDto).department &&
        transaction.receiver === (input as StockOutDto).receiver;

    if (!sameBaseRequest || !sameDetails) {
      throw new ConflictException("Idempotency key was already used for a different stock request.");
    }
    return transaction;
  }

  private validateRequestKey(requestKey: string) {
    if (!isUUID(requestKey, "4")) {
      throw new BadRequestException("A valid Idempotency-Key header is required.");
    }
  }

  private invalidateReadCaches() {
    this.cache.invalidateInventoryReads();
  }

  private toResponse(transaction: TransactionWithDetails) {
    const item = transaction.items[0];
    return {
      id: transaction.id,
      documentNumber: transaction.documentNumber,
      type: transaction.type,
      supplier: transaction.supplier
        ? { id: transaction.supplier.id, name: transaction.supplier.name }
        : null,
      product: item
        ? { id: item.product.id, sku: item.product.sku, name: item.product.name }
        : null,
      quantity: item ? Number(item.quantity) : 0,
      unitCost: item ? Number(item.unitCost) : 0,
      quantityBefore: item ? Number(item.quantityBefore) : 0,
      quantityAfter: item ? Number(item.quantityAfter) : 0,
      department: transaction.department,
      receiver: transaction.receiver,
      notes: transaction.notes,
      transactionDate: transaction.transactionDate.toISOString(),
    };
  }
}
