ALTER TABLE "notifications"
  ADD COLUMN "product_id" UUID,
  ADD COLUMN "resolved_at" TIMESTAMP(3);

ALTER TABLE "notifications"
  DROP CONSTRAINT "notifications_user_id_fkey";

DROP INDEX "notifications_user_id_read_at_idx";

-- Existing alerts shared one read state across every user. Rebuild them from
-- current inventory so each active user starts with an independent alert.
DELETE FROM "notifications";

INSERT INTO "notifications" (
  "id",
  "type",
  "title",
  "message",
  "source_key",
  "user_id",
  "product_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  CASE WHEN p."quantity" = 0 THEN 'OUT_OF_STOCK' ELSE 'LOW_STOCK' END,
  CASE WHEN p."quantity" = 0 THEN 'Product is out of stock' ELSE 'Product is low stock' END,
  p."sku" || ' - ' || p."name" || ' has ' || p."quantity" || ' ' || p."unit" ||
    ' remaining. Minimum stock is ' || p."minimum_stock" || '.',
  'STOCK_ALERT:' || p."id" || ':' || u."id",
  u."id",
  p."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "products" p
CROSS JOIN "user_profiles" u
WHERE p."status" = 'ACTIVE'
  AND p."quantity" <= p."minimum_stock"
  AND u."status" = 'ACTIVE';

ALTER TABLE "notifications"
  ALTER COLUMN "user_id" SET NOT NULL,
  ALTER COLUMN "product_id" SET NOT NULL;

CREATE INDEX "notifications_user_id_resolved_at_read_at_idx"
  ON "notifications"("user_id", "resolved_at", "read_at");
CREATE INDEX "notifications_product_id_resolved_at_idx"
  ON "notifications"("product_id", "resolved_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notifications_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
