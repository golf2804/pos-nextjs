ALTER TABLE "products"
ADD CONSTRAINT "products_costs_nonnegative"
CHECK (
  "cost_price" >= 0 AND
  "average_cost" >= 0 AND
  "selling_price" >= 0 AND
  "minimum_stock" >= 0
) NOT VALID;

ALTER TABLE "inventory_transaction_items"
ADD CONSTRAINT "inventory_transaction_items_values_valid"
CHECK (
  "quantity" > 0 AND
  "unit_cost" >= 0 AND
  "quantity_before" >= 0 AND
  "quantity_after" >= 0
) NOT VALID;

ALTER TABLE "stock_ins"
ADD CONSTRAINT "stock_ins_values_valid"
CHECK (
  "quantity" > 0 AND
  "cost_price" >= 0 AND
  "quantity_before" >= 0 AND
  "quantity_after" >= 0
) NOT VALID;

ALTER TABLE "stock_outs"
ADD CONSTRAINT "stock_outs_values_valid"
CHECK (
  "quantity" > 0 AND
  "unit_cost" >= 0 AND
  "quantity_before" >= 0 AND
  "quantity_after" >= 0
) NOT VALID;

ALTER TABLE "products" VALIDATE CONSTRAINT "products_costs_nonnegative";
ALTER TABLE "inventory_transaction_items" VALIDATE CONSTRAINT "inventory_transaction_items_values_valid";
ALTER TABLE "stock_ins" VALIDATE CONSTRAINT "stock_ins_values_valid";
ALTER TABLE "stock_outs" VALIDATE CONSTRAINT "stock_outs_values_valid";
