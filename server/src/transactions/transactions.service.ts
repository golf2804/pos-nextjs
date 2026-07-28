import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ListTransactionsDto } from "./dto/transaction.dto.js";

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTransactionsDto) {
    const where: Prisma.InventoryTransactionWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.userId) where.createdById = query.userId;
    if (query.productId) where.items = { some: { productId: query.productId } };
    if (query.dateFrom || query.dateTo) {
      where.transactionDate = {
        ...(query.dateFrom ? { gte: bangkokStartOfDay(query.dateFrom) } : {}),
        ...(query.dateTo ? { lt: bangkokNextDay(query.dateTo) } : {}),
      };
    }
    const skip = (query.page - 1) * query.limit;
    const [items, total, users] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : skip,
        take: query.limit,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } }, orderBy: { createdAt: "asc" } },
        },
      }),
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.userProfile.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        documentNumber: item.documentNumber,
        type: item.type,
        status: item.status,
        referenceNumber: item.referenceNumber,
        supplier: item.supplier,
        department: item.department,
        receiver: item.receiver,
        notes: item.notes,
        createdBy: item.createdBy,
        transactionDate: item.transactionDate.toISOString(),
        quantity: item.items.reduce((sum, row) => sum + Number(row.quantity), 0),
        value: item.items.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unitCost), 0),
        items: item.items.map((row) => ({
          id: row.id,
          product: row.product,
          quantity: Number(row.quantity),
          unitCost: Number(row.unitCost),
          quantityBefore: Number(row.quantityBefore),
          quantityAfter: Number(row.quantityAfter),
        })),
      })),
      users,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pageCount: Math.ceil(total / query.limit),
        nextCursor: items.length === query.limit ? items.at(-1)?.id ?? null : null,
      },
    };
  }
}

function bangkokStartOfDay(date: string) {
  return new Date(`${date}T00:00:00.000+07:00`);
}

function bangkokNextDay(date: string) {
  const nextDay = bangkokStartOfDay(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay;
}
