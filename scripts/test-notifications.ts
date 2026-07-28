import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../server/src/auth/auth-user.interface.js";
import { AppRole } from "../server/src/auth/roles.enum.js";
import { NotificationsService } from "../server/src/notifications/notifications.service.js";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { StockService } from "../server/src/stock/stock.service.js";

const prefix = `NOTIFY-TEST-${Date.now()}`;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const servicePrisma = new PrismaService(new ConfigService());
const notifications = new NotificationsService(servicePrisma);
const stock = new StockService(servicePrisma, notifications);

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function main() {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const category = await prisma.category.create({ data: { name: `${prefix}-CATEGORY` } });
  const supplier = await prisma.supplier.create({ data: { name: `${prefix}-SUPPLIER` } });
  const users = await Promise.all([1, 2].map((number) => prisma.userProfile.create({
    data: {
      authUserId: randomUUID(),
      username: `${prefix.toLowerCase()}-${number}`,
      email: `${prefix.toLowerCase()}-${number}@inventory.test`,
      fullName: `Notification Test User ${number}`,
      roleId: role.id,
    },
  })));
  const actors = users.map((user): AuthUser => ({
    id: user.id,
    authUserId: user.authUserId,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: null,
    role: AppRole.ADMIN,
  }));
  const product = await prisma.product.create({
    data: {
      sku: `${prefix}-MAIN`,
      name: "Notification Test Product",
      categoryId: category.id,
      costPrice: 10,
      averageCost: 10,
      sellingPrice: 15,
      quantity: 6,
      minimumStock: 5,
      unit: "pcs",
      suppliers: { create: { supplierId: supplier.id, isPrimary: true } },
    },
  });

  await stock.stockOut({
    productId: product.id,
    quantity: 1,
    department: "QA",
    receiver: "Notification Test",
    date: new Date().toISOString(),
  }, actors[0], randomUUID());
  let alerts = await prisma.notification.findMany({
    where: { productId: product.id, userId: { in: users.map((user) => user.id) } },
  });
  expect(alerts.length === 2 && alerts.every((item) => item.type === "LOW_STOCK"), "Stock Out creates one Low Stock alert per user immediately");

  const firstUserAlert = alerts.find((item) => item.userId === users[0].id)!;
  const secondUserAlert = alerts.find((item) => item.userId === users[1].id)!;
  await notifications.markRead(firstUserAlert.id, actors[0]);
  const readStates = await prisma.notification.findMany({
    where: { id: { in: [firstUserAlert.id, secondUserAlert.id] } },
    orderBy: { userId: "asc" },
  });
  expect(readStates.filter((item) => item.readAt !== null).length === 1, "Read state is independent for each user");

  let ownershipProtected = false;
  try {
    await notifications.markRead(firstUserAlert.id, actors[1]);
  } catch {
    ownershipProtected = true;
  }
  expect(ownershipProtected, "A user cannot mark another user's notification as read");

  await stock.stockOut({
    productId: product.id,
    quantity: 5,
    department: "QA",
    receiver: "Notification Test",
    date: new Date().toISOString(),
  }, actors[0], randomUUID());
  alerts = await prisma.notification.findMany({
    where: { productId: product.id, userId: { in: users.map((user) => user.id) } },
  });
  expect(alerts.length === 2 && alerts.every((item) => item.type === "OUT_OF_STOCK" && item.readAt === null), "Low Stock transitions to Out Of Stock without duplicates and resets unread state");

  await stock.stockIn({
    productId: product.id,
    supplierId: supplier.id,
    quantity: 10,
    costPrice: 10,
    date: new Date().toISOString(),
  }, actors[0], randomUUID());
  alerts = await prisma.notification.findMany({
    where: { productId: product.id, userId: { in: users.map((user) => user.id) } },
  });
  expect(alerts.every((item) => item.resolvedAt !== null), "Stock In resolves alerts when inventory returns above minimum");

  await stock.stockOut({
    productId: product.id,
    quantity: 5,
    department: "QA",
    receiver: "Notification Test",
    date: new Date().toISOString(),
  }, actors[0], randomUUID());
  alerts = await prisma.notification.findMany({
    where: { productId: product.id, userId: { in: users.map((user) => user.id) } },
  });
  expect(alerts.length === 2 && alerts.every((item) => item.type === "LOW_STOCK" && item.resolvedAt === null && item.readAt === null), "Resolved alert reopens as unread without creating a duplicate");

  const extraProducts = await Promise.all(Array.from({ length: 11 }, (_, index) => prisma.product.create({
    data: {
      sku: `${prefix}-PAGE-${index + 1}`,
      name: `Pagination Product ${index + 1}`,
      categoryId: category.id,
      quantity: 1,
      minimumStock: 2,
      unit: "pcs",
    },
  })));
  const pollOnlyProduct = await prisma.product.create({
    data: {
      sku: `${prefix}-POLL-ONLY`,
      name: "Polling Must Stay Read Only",
      categoryId: category.id,
      quantity: 1,
      minimumStock: 2,
      unit: "pcs",
    },
  });
  const notificationCountBeforeRead = await prisma.notification.count({ where: { productId: pollOnlyProduct.id } });
  await notifications.list({ status: "active", page: 1, limit: 5 }, actors[0]);
  const notificationCountAfterRead = await prisma.notification.count({ where: { productId: pollOnlyProduct.id } });
  expect(notificationCountBeforeRead === 0 && notificationCountAfterRead === 0, "Notification polling is read-only");
  await notifications.syncProductAlerts(pollOnlyProduct.id);
  for (const extra of extraProducts) await notifications.syncProductAlerts(extra.id);
  const page = await notifications.list({ type: "LOW_STOCK", status: "active", page: 1, limit: 5 }, actors[0]);
  expect(page.items.length === 5 && page.meta.total >= 12 && page.meta.pageCount >= 3, "Notification filters and server-side pagination return correct metadata");
}

async function cleanup() {
  const products = await prisma.product.findMany({
    where: { sku: { startsWith: prefix } },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);
  if (productIds.length) {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { items: { some: { productId: { in: productIds } } } },
      select: { id: true },
    });
    const transactionIds = transactions.map((transaction) => transaction.id);
    await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockIn.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.stockOut.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventoryTransactionItem.deleteMany({ where: { productId: { in: productIds } } });
    if (transactionIds.length) await prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } });
    await prisma.productSupplier.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  await prisma.userProfile.deleteMany({ where: { username: { startsWith: prefix.toLowerCase() } } });
  await prisma.supplier.deleteMany({ where: { name: `${prefix}-SUPPLIER` } });
  await prisma.category.deleteMany({ where: { name: `${prefix}-CATEGORY` } });
}

void main()
  .finally(cleanup)
  .finally(async () => {
    await servicePrisma.onModuleDestroy();
    await prisma.$disconnect();
  });
