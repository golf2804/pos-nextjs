ALTER TABLE "inventory_transactions"
ADD COLUMN "request_key" UUID;

CREATE UNIQUE INDEX "inventory_transactions_request_key_key"
ON "inventory_transactions"("request_key");

ALTER TABLE "products"
ADD CONSTRAINT "products_quantity_nonnegative"
CHECK ("quantity" >= 0) NOT VALID;

ALTER TABLE "products"
VALIDATE CONSTRAINT "products_quantity_nonnegative";
