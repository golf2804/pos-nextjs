import type { QueryClient } from "@tanstack/react-query";

const inventoryQueryRoots = new Set([
  "dashboard",
  "notifications",
  "operation-products",
  "product-options",
  "products",
  "reconciliation",
  "reports",
  "reversible-transactions",
  "stock-in-products",
  "stock-out-products",
  "transactions",
]);

export function invalidateInventoryQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => inventoryQueryRoots.has(String(query.queryKey[0] ?? "")),
  });
}
