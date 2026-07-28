import "dotenv/config";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { TtlCacheService } from "../server/src/common/ttl-cache.service.js";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

async function main() {
  const health = await fetch(`${apiBase}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.ok(health.headers.get("x-request-id"));
  assert.match(health.headers.get("permissions-policy") ?? "", /camera/);
  console.log("PASS 74.1: Liveness and production security headers");

  const ready = await fetch(`${apiBase}/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal(((await ready.json()) as { database?: string }).database, "up");
  console.log("PASS 74.2: Database readiness monitoring");

  assert.equal((await fetch(`${apiBase}/products`)).status, 401);
  const foreignOrigin = await fetch(`${apiBase}/health`, { headers: { origin: "https://untrusted.example" } });
  assert.notEqual(foreignOrigin.headers.get("access-control-allow-origin"), "https://untrusted.example");
  console.log("PASS 74.3: Protected API and CORS boundary");

  const cache = new TtlCacheService();
  let loads = 0;
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.getOrSet("load", 1_000, async () => ++loads)));
  assert.equal(loads, 1);
  assert.ok(values.every((value) => value === 1));
  console.log("PASS 74.4: Concurrent cache requests collapse to one loader");

  const durations: number[] = [];
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now();
    const response = await fetch(`${apiBase}/health`);
    assert.equal(response.status, 200);
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? Infinity;
  assert.ok(p95 < 500, `Health endpoint p95 was ${p95.toFixed(1)}ms.`);
  console.log(`PASS 74.5: Health endpoint p95 ${p95.toFixed(1)}ms (<500ms)`);
  console.log("Production readiness smoke test completed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
