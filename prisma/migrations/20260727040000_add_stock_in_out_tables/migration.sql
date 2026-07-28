CREATE TABLE "stock_ins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "cost_price" DECIMAL(18,4) NOT NULL,
  "quantity_before" DECIMAL(18,4) NOT NULL,
  "quantity_after" DECIMAL(18,4) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_ins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_outs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit_cost" DECIMAL(18,4) NOT NULL,
  "quantity_before" DECIMAL(18,4) NOT NULL,
  "quantity_after" DECIMAL(18,4) NOT NULL,
  "department" TEXT NOT NULL,
  "receiver" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_outs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_ins_transaction_id_key" ON "stock_ins"("transaction_id");
CREATE INDEX "stock_ins_product_id_date_idx" ON "stock_ins"("product_id", "date");
CREATE INDEX "stock_ins_supplier_id_date_idx" ON "stock_ins"("supplier_id", "date");
CREATE INDEX "stock_ins_created_by_id_date_idx" ON "stock_ins"("created_by_id", "date");

CREATE UNIQUE INDEX "stock_outs_transaction_id_key" ON "stock_outs"("transaction_id");
CREATE INDEX "stock_outs_product_id_date_idx" ON "stock_outs"("product_id", "date");
CREATE INDEX "stock_outs_created_by_id_date_idx" ON "stock_outs"("created_by_id", "date");
CREATE INDEX "stock_outs_department_date_idx" ON "stock_outs"("department", "date");

ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_outs" ADD CONSTRAINT "stock_outs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_outs" ADD CONSTRAINT "stock_outs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_outs" ADD CONSTRAINT "stock_outs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
