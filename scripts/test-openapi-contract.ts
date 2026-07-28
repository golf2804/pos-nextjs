import "dotenv/config";
import assert from "node:assert/strict";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function main() {
  const response = await fetch(`${apiBase}/docs/openapi.json`);
  assert.equal(response.ok, true, "OpenAPI JSON must be available in the test environment.");
  const document = await response.json() as {
    paths?: Record<string, unknown>;
    components?: { schemas?: Record<string, { properties?: Record<string, unknown>; required?: string[] }> };
  };
  assert.ok(document.paths?.["/api/products"]);
  assert.ok(document.paths?.["/api/users/{id}/reset-password"]);

  const product = document.components?.schemas?.CreateProductDto;
  assert.ok(product, "CreateProductDto schema is missing.");
  for (const property of ["sku", "name", "categoryId", "costPrice", "sellingPrice", "quantity", "minimumStock", "unit"]) {
    assert.ok(product.properties?.[property], `CreateProductDto.${property} is missing from OpenAPI.`);
  }
  assert.ok(product.required?.includes("sku"));
  assert.ok(product.required?.includes("name"));
  console.log("PASS SECURITY 7.2: OpenAPI publishes populated DTO contracts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
