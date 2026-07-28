import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath } from "../../lib/auth/safe-redirect.js";
import { parseAllowedOrigins } from "../../server/src/common/security-config.js";

test("safeInternalPath accepts only local application paths", () => {
  assert.equal(safeInternalPath("/products?page=2#stock"), "/products?page=2#stock");
  assert.equal(safeInternalPath(undefined, "/dashboard"), "/dashboard");
  assert.equal(safeInternalPath("https://attacker.example"), "/");
  assert.equal(safeInternalPath("//attacker.example"), "/");
  assert.equal(safeInternalPath("/%5c%5cattacker.example"), "/");
  assert.equal(safeInternalPath(`/products${String.fromCharCode(10)}x`), "/");
});

test("parseAllowedOrigins normalizes and deduplicates development origins", () => {
  assert.deepEqual(
    parseAllowedOrigins("http://localhost:3000, http://localhost:3000, https://inventory.example", false),
    ["http://localhost:3000", "https://inventory.example"],
  );
});

test("parseAllowedOrigins fails closed for unsafe production configuration", () => {
  for (const value of [
    "",
    "*",
    "http://inventory.example",
    "https://localhost:3000",
    "https://user:pass@inventory.example",
    "https://inventory.example/path",
    "ftp://inventory.example",
    "not a URL",
  ]) {
    assert.throws(() => parseAllowedOrigins(value, true));
  }

  assert.deepEqual(parseAllowedOrigins("https://inventory.example", true), ["https://inventory.example"]);
});
