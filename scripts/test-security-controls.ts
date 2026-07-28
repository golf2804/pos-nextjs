import "dotenv/config";
import assert from "node:assert/strict";
import { safeInternalPath } from "../lib/auth/safe-redirect.js";
import { parseAllowedOrigins } from "../server/src/common/security-config.js";

const frontendBase = process.env.FRONTEND_URL?.split(",")[0]?.trim() ?? "http://localhost:3000";

async function main() {
  assert.equal(safeInternalPath("/products?page=2"), "/products?page=2");
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example"]) {
    assert.equal(safeInternalPath(unsafe), "/", `Unsafe redirect was accepted: ${unsafe}`);
  }
  assert.deepEqual(
    parseAllowedOrigins("https://inventory.example,https://inventory.example", true),
    ["https://inventory.example"],
  );
  assert.throws(() => parseAllowedOrigins("*", true), /wildcard/);
  assert.throws(() => parseAllowedOrigins("http://inventory.example", true), /HTTPS/);
  assert.throws(() => parseAllowedOrigins("https://inventory.example/path", true), /origin without/);

  const response = await fetch(`${frontendBase}/login`, { redirect: "manual" });
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'self' 'nonce-[^']+'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");

  console.log("PASS SECURITY 7.3: redirects are internal-only and production CORS config fails closed");
  console.log("PASS SECURITY 7.4: frontend responses include nonce CSP and anti-framing headers");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
