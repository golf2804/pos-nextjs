CREATE INDEX "inventory_transactions_reference_number_idx"
ON "inventory_transactions"("reference_number");

CREATE UNIQUE INDEX "inventory_transactions_reversal_reference_key"
ON "inventory_transactions"("reference_number")
WHERE "type" = 'REVERSAL' AND "status" = 'CONFIRMED';

ALTER TABLE "inventory_transaction_items"
ADD CONSTRAINT "inventory_transaction_items_movement_matches_quantity"
CHECK ("quantity" = ABS("quantity_after" - "quantity_before")) NOT VALID;

ALTER TABLE "inventory_transactions"
ADD CONSTRAINT "inventory_reversal_reference_required"
CHECK ("type" <> 'REVERSAL' OR "reference_number" IS NOT NULL) NOT VALID;

ALTER TABLE "inventory_transaction_items"
VALIDATE CONSTRAINT "inventory_transaction_items_movement_matches_quantity";

ALTER TABLE "inventory_transactions"
VALIDATE CONSTRAINT "inventory_reversal_reference_required";
