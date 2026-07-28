import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const quantityMismatches = await prisma.$queryRaw<Array<{
    sku: string;
    product_quantity: string;
    ledger_quantity: string;
  }>>`
    SELECT
      p.sku,
      p.quantity::text AS product_quantity,
      COALESCE(SUM(i.quantity_after - i.quantity_before), 0)::text AS ledger_quantity
    FROM products AS p
    LEFT JOIN inventory_transaction_items AS i ON i.product_id = p.id
    WHERE p.status <> 'ARCHIVED'
    GROUP BY p.id, p.sku, p.quantity
    HAVING ABS(p.quantity - COALESCE(SUM(i.quantity_after - i.quantity_before), 0)) >= 0.0001
  `;
  assert.deepEqual(
    quantityMismatches,
    [],
    `Product quantities differ from the inventory ledger: ${JSON.stringify(quantityMismatches)}`,
  );

  const emptyTransactions = await prisma.$queryRaw<Array<{ document_number: string }>>`
    SELECT transaction.document_number
    FROM inventory_transactions AS transaction
    LEFT JOIN inventory_transaction_items AS item ON item.transaction_id = transaction.id
    GROUP BY transaction.id, transaction.document_number
    HAVING COUNT(item.id) = 0
  `;
  assert.deepEqual(emptyTransactions, [], `Transactions without items: ${JSON.stringify(emptyTransactions)}`);

  const invalidStockLinks = await prisma.$queryRaw<Array<{ document_number: string; source: string }>>`
    SELECT transaction.document_number, 'stock_in' AS source
    FROM stock_ins AS stock
    JOIN inventory_transactions AS transaction ON transaction.id = stock.transaction_id
    LEFT JOIN inventory_transaction_items AS item
      ON item.transaction_id = transaction.id AND item.product_id = stock.product_id
    WHERE transaction.type <> 'STOCK_IN'
      OR item.id IS NULL
      OR item.quantity <> stock.quantity
    UNION ALL
    SELECT transaction.document_number, 'stock_out' AS source
    FROM stock_outs AS stock
    JOIN inventory_transactions AS transaction ON transaction.id = stock.transaction_id
    LEFT JOIN inventory_transaction_items AS item
      ON item.transaction_id = transaction.id AND item.product_id = stock.product_id
    WHERE transaction.type <> 'STOCK_OUT'
      OR item.id IS NULL
      OR item.quantity <> stock.quantity
  `;
  assert.deepEqual(invalidStockLinks, [], `Stock records do not match transaction items: ${JSON.stringify(invalidStockLinks)}`);

  console.log("PASS SECURITY 2.1: product quantities match the inventory ledger");
  console.log("PASS SECURITY 2.2: every transaction contains at least one item");
  console.log("PASS SECURITY 2.3: Stock In/Out records match their transaction headers and items");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
