import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { TransactionsService } from "../server/src/transactions/transactions.service.js";

const prisma = new PrismaService(new ConfigService(process.env));
const transactions = new TransactionsService(prisma);
const marker = `DATE-BOUNDARY-${randomUUID().slice(0, 8)}`;
const transactionIds: string[] = [];
let categoryId = "";
let productId = "";

async function main() {
  const actor = await prisma.userProfile.findFirstOrThrow({ where: { status: "ACTIVE" } });
  categoryId = (await prisma.category.create({ data: { name: `${marker}-CATEGORY` } })).id;
  productId = (await prisma.product.create({
    data: {
      sku: `${marker}-SKU`,
      name: `${marker} Product`,
      categoryId,
      costPrice: 1,
      averageCost: 1,
      sellingPrice: 1,
      quantity: 3,
      minimumStock: 0,
      unit: "pcs",
    },
  })).id;

  transactionIds.push((await createTransaction("2026-01-15T00:00:00.000+07:00", actor.id)).id);
  transactionIds.push((await createTransaction("2026-01-15T23:59:59.999+07:00", actor.id)).id);
  transactionIds.push((await createTransaction("2026-01-16T00:00:00.000+07:00", actor.id)).id);

  const result = await transactions.list({
    productId,
    dateFrom: "2026-01-15",
    dateTo: "2026-01-15",
    page: 1,
    limit: 100,
  });
  assert.equal(result.meta.total, 2);
  assert.equal(result.items.every((item) => item.transactionDate.startsWith("2026-01-14T17:") || item.transactionDate.startsWith("2026-01-15T16:")), true);
  console.log("PASS CORRECTNESS 5.1: dateTo includes the complete selected Bangkok calendar day");

  const firstPage = await transactions.list({ productId, page: 1, limit: 2 });
  assert.ok(firstPage.meta.nextCursor);
  const cursorPage = await transactions.list({
    productId,
    cursor: firstPage.meta.nextCursor ?? undefined,
    page: 1,
    limit: 2,
  });
  assert.equal(cursorPage.items.length, 1);
  assert.equal(new Set([...firstPage.items, ...cursorPage.items].map((item) => item.id)).size, 3);
  console.log("PASS PERFORMANCE 6.1: transaction cursor pagination returns stable non-overlapping pages");
}

function createTransaction(transactionDate: string, createdById: string) {
  return prisma.inventoryTransaction.create({
    data: {
      documentNumber: `${marker}-${randomUUID().slice(0, 8)}`,
      type: "ADJUSTMENT",
      transactionDate: new Date(transactionDate),
      createdById,
      items: {
        create: { productId, quantity: 1, unitCost: 0, quantityBefore: 0, quantityAfter: 1 },
      },
    },
  });
}

async function cleanup() {
  if (transactionIds.length) {
    await prisma.inventoryTransactionItem.deleteMany({ where: { transactionId: { in: transactionIds } } });
    await prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  }
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
