import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../server/src/auth/auth-user.interface.js";
import { AppRole } from "../server/src/auth/roles.enum.js";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { NotificationsService } from "../server/src/notifications/notifications.service.js";
import { ProductsService } from "../server/src/products/products.service.js";
import { InventoryOperationsService } from "../server/src/stock/inventory-operations.service.js";
import { StockService } from "../server/src/stock/stock.service.js";
import { TtlCacheService } from "../server/src/common/ttl-cache.service.js";

const prisma = new PrismaService(new ConfigService(process.env));
const notifications = new NotificationsService(prisma);
const cache = new TtlCacheService();
const stock = new StockService(prisma, notifications, cache);
const products = new ProductsService(prisma, notifications);
const operations = new InventoryOperationsService(prisma, notifications, cache);
const marker = randomUUID().slice(0, 8);
let productId: string | undefined;
let categoryId: string | undefined;
let supplierId: string | undefined;
let initialProductId: string | undefined;

async function cleanup() {
  const productIds = [productId, initialProductId].filter((id): id is string => Boolean(id));
  if (productIds.length) {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { items: { some: { productId: { in: productIds } } } },
      select: { id: true },
    });
    const transactionIds = transactions.map(({ id }) => id);
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { entityId: { in: transactionIds } } }),
      prisma.auditLog.deleteMany({ where: { entityId: { in: productIds } } }),
      prisma.stockIn.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.stockOut.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.inventoryTransactionItem.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } }),
      prisma.productSupplier.deleteMany({ where: { productId: { in: productIds } } }),
      prisma.product.deleteMany({ where: { id: { in: productIds } } }),
    ]);
  }
  if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
}

async function main() {
  const profile = await prisma.userProfile.findFirst({
    where: { status: "ACTIVE" },
    include: { role: true },
  });
  if (!profile) throw new Error("An active user profile is required for the stock test.");

  const user: AuthUser = {
    id: profile.id,
    authUserId: profile.authUserId,
    username: profile.username,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    role: profile.role.code as AppRole,
  };
  const category = await prisma.category.create({
    data: { name: `TEST-STOCK-${marker}`, status: "ACTIVE" },
  });
  categoryId = category.id;
  const supplier = await prisma.supplier.create({
    data: { name: `TEST-STOCK-${marker}`, status: "ACTIVE" },
  });
  supplierId = supplier.id;
  const initialProduct = await products.create({
    sku: `INITIAL-${marker}`,
    name: `Initial Stock Test ${marker}`,
    categoryId,
    supplierId,
    costPrice: 10,
    sellingPrice: 15,
    quantity: 8,
    minimumStock: 1,
    unit: "piece",
    status: "ACTIVE",
  }, user);
  initialProductId = initialProduct.id;
  const initialTransaction = await prisma.inventoryTransaction.findFirstOrThrow({
    where: { referenceNumber: "INITIAL-STOCK", items: { some: { productId: initialProductId } } },
    include: { items: true },
  });
  assert.equal(initialTransaction.type, "ADJUSTMENT");
  assert.equal(Number(initialTransaction.items[0]?.quantityAfter), 8);
  assert.equal(initialProduct.quantity, 8);
  console.log("PASS: product initial quantity creates an inventory transaction");
  const product = await prisma.product.create({
    data: {
      sku: `TEST-${marker}`,
      name: `Concurrency Test ${marker}`,
      categoryId,
      unit: "piece",
      quantity: 0,
      minimumStock: 0,
      costPrice: 0,
      averageCost: 0,
      sellingPrice: 0,
      status: "ACTIVE",
    },
  });
  productId = product.id;
  const date = new Date().toISOString();

  const stockInKey = randomUUID();
  const stockInInput = { productId, supplierId, quantity: 10, costPrice: 25, date };
  let stockCacheLoads = 0;
  await cache.getOrSet("reports:test-stock-in", 60_000, async () => ++stockCacheLoads);
  const firstStockIn = await stock.stockIn(stockInInput, user, stockInKey);
  await cache.getOrSet("reports:test-stock-in", 60_000, async () => ++stockCacheLoads);
  assert.equal(stockCacheLoads, 2);
  const repeatedStockIn = await stock.stockIn(stockInInput, user, stockInKey);
  assert.equal(repeatedStockIn.id, firstStockIn.id, "Repeated request must return the original transaction.");
  assert.equal(firstStockIn.unitCost, 25, "Stock In must retain its submitted unit cost.");
  await assert.rejects(() => stock.stockIn({ ...stockInInput, costPrice: 26 }, user, stockInKey));
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 10);
  assert.equal(await prisma.stockIn.count({ where: { productId } }), 1);
  console.log("PASS: repeated Stock In is recorded once");

  const secondStockIn = await stock.stockIn({
    productId,
    supplierId,
    quantity: 10,
    costPrice: 35,
    date,
  }, user, randomUUID());
  const valuedProduct = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(Number(valuedProduct.quantity), 20);
  assert.equal(Number(valuedProduct.averageCost), 30);
  assert.equal(secondStockIn.unitCost, 35);
  assert.equal(await prisma.stockIn.count({ where: { productId } }), 2);
  console.log("PASS: weighted average cost is calculated from both receipts");

  await products.update(productId, { costPrice: 99 }, user);
  const repricedProduct = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(Number(repricedProduct.costPrice), 99);
  assert.equal(Number(repricedProduct.averageCost), 30);
  console.log("PASS: editing product cost does not revalue existing inventory");

  const concurrent = await Promise.allSettled([
    stock.stockOut({ productId, quantity: 15, department: "TEST", receiver: "A", date }, user, randomUUID()),
    stock.stockOut({ productId, quantity: 15, department: "TEST", receiver: "B", date }, user, randomUUID()),
  ]);
  assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(concurrent.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 5);
  assert.equal(await prisma.stockOut.count({ where: { productId } }), 1);
  const outgoing = await prisma.stockOut.findFirstOrThrow({ where: { productId } });
  assert.equal(Number(outgoing.unitCost), 30);
  console.log("PASS: concurrent Stock Out cannot make inventory negative");

  await assert.rejects(() => stock.stockOut({
    productId: product.id,
    quantity: 6,
    department: "TEST",
    receiver: "C",
    date,
  }, user, randomUUID()));
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 5);
  console.log("PASS: insufficient Stock Out is rejected without changing inventory");

  const adjustmentKey = randomUUID();
  const adjustmentInput = { productId, countedQuantity: 8, reason: "Cycle count", date };
  let operationCacheLoads = 0;
  await cache.getOrSet("dashboard:test-adjustment", 60_000, async () => ++operationCacheLoads);
  const adjustment = await operations.adjust(adjustmentInput, user, adjustmentKey);
  await cache.getOrSet("dashboard:test-adjustment", 60_000, async () => ++operationCacheLoads);
  assert.equal(operationCacheLoads, 2);
  const repeatedAdjustment = await operations.adjust(adjustmentInput, user, adjustmentKey);
  assert.equal(repeatedAdjustment.id, adjustment.id);
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 8);
  await assert.rejects(() => operations.adjust({ ...adjustmentInput, reason: "Different reason" }, user, adjustmentKey));
  console.log("PASS: stock adjustment records the counted quantity once");

  const returnOut = await operations.returnOut({
    productId,
    supplierId,
    quantity: 2,
    referenceNumber: "SUP-RETURN-1",
    date,
  }, user, randomUUID());
  assert.equal(returnOut.type, "RETURN_OUT");
  assert.equal(returnOut.quantityAfter, 6);
  const returnIn = await operations.returnIn({
    productId,
    quantity: 3,
    department: "TEST",
    receiver: "Warehouse",
    referenceNumber: "DEPT-RETURN-1",
    date,
  }, user, randomUUID());
  assert.equal(returnIn.type, "RETURN_IN");
  assert.equal(returnIn.quantityAfter, 9);
  console.log("PASS: return out and return in update inventory with references");

  const reversalKey = randomUUID();
  const reversalInput = { reason: "Incorrect supplier return", date };
  const reversal = await operations.reverse(returnOut.id, reversalInput, user, reversalKey);
  const repeatedReversal = await operations.reverse(returnOut.id, reversalInput, user, reversalKey);
  assert.equal(repeatedReversal.id, reversal.id);
  assert.equal(reversal.type, "REVERSAL");
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 11);
  assert.equal((await prisma.inventoryTransaction.findUniqueOrThrow({ where: { id: returnOut.id } })).status, "REVERSED");
  await assert.rejects(() => operations.reverse(returnOut.id, reversalInput, user, randomUUID()));
  console.log("PASS: reversal restores inventory and cannot be duplicated");

  const reconciled = await operations.reconciliation();
  assert.equal(reconciled.items.find((item) => item.productId === productId)?.status, "MATCH");
  await prisma.product.update({ where: { id: productId }, data: { quantity: 12 } });
  const mismatch = await operations.reconciliation();
  assert.equal(mismatch.items.find((item) => item.productId === productId)?.difference, 1);
  await operations.repairReconciliation(productId, { reason: "Repair test mismatch", date }, user, randomUUID());
  const repaired = await operations.reconciliation();
  assert.equal(repaired.items.find((item) => item.productId === productId)?.status, "MATCH");
  assert.equal(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).quantity), 12);
  console.log("PASS: reconciliation detects and repairs ledger mismatch without changing physical stock");
  console.log("PASS: stock and inventory operations invalidate dashboard/report caches after commit");
}

main()
  .then(() => console.log("Stock transaction safety test completed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
