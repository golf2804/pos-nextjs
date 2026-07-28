import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../server/src/prisma/prisma.service.js";
import { ReportsService } from "../server/src/reports/reports.service.js";

const marker = `TEST-REPORT-${Date.now()}`;
const prisma = new PrismaService(new ConfigService(process.env));
const reports = new ReportsService(prisma);
let categoryId = "";
let productId = "";
const transactionIds: string[] = [];

async function main() {
  const actor = await prisma.userProfile.findFirstOrThrow({ where: { status: "ACTIVE", role: { code: "ADMIN" } } });
  categoryId = (await prisma.category.create({ data: { name: `${marker}-CATEGORY` } })).id;
  productId = (await prisma.product.create({ data: { sku: `${marker}-SKU`, name: `${marker} Product`, categoryId, costPrice: 12.5, averageCost: 12.5, sellingPrice: 20, quantity: 5, minimumStock: 2, unit: "pcs" } })).id;
  transactionIds.push((await createTransaction("STOCK_IN", 4, 0, 4, actor.id)).id);
  transactionIds.push((await createTransaction("RETURN_IN", 2, 4, 6, actor.id)).id);
  transactionIds.push((await createTransaction("RETURN_OUT", 1, 6, 5, actor.id)).id);

  for (const period of ["daily", "weekly", "monthly", "yearly"] as const) {
    const report = await reports.getReport({ period });
    assert.ok(report.summary.stockIn >= 6);
    assert.ok(report.summary.stockOut >= 1);
    assert.ok(report.movement.length > 0);
  }
  console.log("PASS 66.1: Reports aggregate Stock In/Out and Return In/Out movement");

  await assert.rejects(
    reports.getReport({ period: "daily", dateFrom: "2025-01-01", dateTo: "2025-03-01" }),
    /daily reports are limited to 31 days/,
  );
  await assert.rejects(
    reports.getReport({ period: "monthly", dateFrom: "2025-01-01" }),
    /dateFrom and dateTo must be provided together/,
  );
  console.log("PASS 66.2: Invalid and oversized report ranges are rejected");

  const excel = await reports.toExcel({ period: "daily" });
  assert.equal(excel.subarray(0, 2).toString(), "PK");
  assert.ok(excel.length > 1000);
  console.log("PASS 66.3: Excel export is a non-empty XLSX archive");

  const pdf = await reports.toPdf({ period: "daily" });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
  console.log("PASS 66.4: PDF export is a non-empty PDF document");
  console.log("Reports and exports integration test completed.");
}

async function cleanup() {
  if (transactionIds.length) {
    await prisma.inventoryTransactionItem.deleteMany({ where: { transactionId: { in: transactionIds } } });
    await prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  }
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
}

function createTransaction(
  type: "STOCK_IN" | "RETURN_IN" | "RETURN_OUT",
  quantity: number,
  quantityBefore: number,
  quantityAfter: number,
  createdById: string,
) {
  return prisma.inventoryTransaction.create({
    data: {
      documentNumber: `${marker}-${randomUUID().slice(0, 8)}`,
      type,
      transactionDate: new Date(),
      createdById,
      items: { create: { productId, quantity, unitCost: 12.5, quantityBefore, quantityAfter } },
    },
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
