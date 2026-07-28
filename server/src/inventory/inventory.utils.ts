import { randomUUID } from "node:crypto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export type InventoryDocumentPrefix = "SI" | "SO" | "ADJ" | "RTI" | "RTO" | "REV";

export type LockedInventoryProduct = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  quantity: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  costPrice: Prisma.Decimal;
};

export function createInventoryDocumentNumber(prefix: InventoryDocumentPrefix) {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `${prefix}-${today}-${suffix}`;
}

export function inventoryTransactionOptions() {
  return {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5_000,
    timeout: 15_000,
  } as const;
}

export async function lockActiveProduct(tx: Prisma.TransactionClient, productId: string) {
  const products = await tx.$queryRaw<LockedInventoryProduct[]>`
    SELECT id, status, quantity, average_cost AS "averageCost", cost_price AS "costPrice"
    FROM products
    WHERE id = ${productId}::uuid
    FOR UPDATE
  `;
  const product = products[0];
  if (!product) throw new NotFoundException("Product not found.");
  if (product.status !== "ACTIVE") throw new BadRequestException("Product is not active.");
  return product;
}
