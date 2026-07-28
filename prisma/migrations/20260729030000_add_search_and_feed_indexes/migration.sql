CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_sku_trgm_idx" ON "products" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "products_barcode_trgm_idx" ON "products" USING GIN ("barcode" gin_trgm_ops);
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "categories_description_trgm_idx" ON "categories" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "suppliers_name_trgm_idx" ON "suppliers" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "suppliers_email_trgm_idx" ON "suppliers" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "suppliers_phone_trgm_idx" ON "suppliers" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "inventory_transactions_document_trgm_idx" ON "inventory_transactions" USING GIN ("document_number" gin_trgm_ops);
CREATE INDEX "inventory_transactions_reference_trgm_idx" ON "inventory_transactions" USING GIN ("reference_number" gin_trgm_ops);
CREATE INDEX "inventory_transactions_receiver_trgm_idx" ON "inventory_transactions" USING GIN ("receiver" gin_trgm_ops);
CREATE INDEX "inventory_transactions_department_trgm_idx" ON "inventory_transactions" USING GIN ("department" gin_trgm_ops);
CREATE INDEX "inventory_transactions_status_date_idx" ON "inventory_transactions" ("status", "transaction_date" DESC);
CREATE INDEX "notifications_user_feed_idx" ON "notifications" ("user_id", "resolved_at", "read_at", "updated_at" DESC);
