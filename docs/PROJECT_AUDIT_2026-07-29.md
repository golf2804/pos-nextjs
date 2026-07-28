# Full Project Audit

Audit date: 2026-07-29  
Scope: Next.js frontend, NestJS API, Supabase PostgreSQL/Auth/Storage, Prisma, reports, caching, tests, and production tooling.

Remediation update: the reversible managed-password finding was resolved on 2026-07-29. Migration `20260729010000_remove_reversible_passwords` was deployed, the password-reveal API/UI and encryption key were removed, and User Management now stores only `password_updated_at`. Admins can replace a permanent password, but no password can be retrieved.

## Verification Performed

- `npm run verify`: passed (ESLint, NestJS TypeScript build, Next.js production build; 19 routes).
- `npm run verify:integration`: passed, including auth/RBAC, catalog, users, reports, stock concurrency, notifications, performance guards, production smoke, and Playwright (2/2).
- `npx prisma migrate status`: all 10 migrations applied; database schema is up to date.
- `npm audit --omit=dev --audit-level=moderate`: 15 unresolved production advisories (14 high, 1 moderate, 0 critical).
- Live OpenAPI probe: 33 paths, but generated DTO property schemas are empty.
- Live Supabase metadata probe: application tables in `public` have RLS disabled and broad `anon`/`authenticated` grants.
- Read-only PostgREST proof at audit time: the publishable key returned HTTP 200/206 for `products`, `managed_credentials`, `audit_logs`, and `_prisma_migrations`. The `managed_credentials` table has since been dropped; the broader PostgREST exposure remains unresolved.
- Docker, `pg_dump`, `pg_restore`, and Git were not installed, so container execution, restore drills, and commit-history secret scanning could not be verified.

## 1. Architecture & Code Structure

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Dashboard contains a second application shell | Medium | `app/layout.tsx:37-39`, `app/page.tsx:52-64`, `app/page.tsx:92-127`, `components/layout/app-shell.tsx:92-139` | Root layout already wraps every protected page in `AppShell`, but Dashboard renders another sidebar/header/navigation. This duplicates state, navigation, role visibility, and mobile behavior. | Remove Dashboard's embedded shell and retain only dashboard content under the shared `AppShell`. |
| Inventory operations service is a god object | Medium | `server/src/stock/inventory-operations.service.ts:32`, `:88`, `:190`, `:226`, `:263`, `:304`, `:359-461` | One 461-line service owns adjustments, reversals, returns, reconciliation, idempotency matching, audit writes, and response mapping. Change risk and test setup are unnecessarily coupled. | Split into adjustment/return, reversal, and reconciliation services; extract a shared idempotency/transaction response component. |
| Frontend/backend validation contracts are duplicated and already differ | Medium | `components/products/product-form.tsx:24-41`, `server/src/products/dto/product.dto.ts:50-107` | Frontend requires `imageUrl` to be a URL while the API accepts any string. Hand-maintained TypeScript types, Zod schemas, and DTOs can continue drifting. | Generate an API client/schema from OpenAPI after fixing Swagger metadata, or share framework-neutral schemas and add contract tests. |

Verified strengths: domain-oriented Nest modules are clear, controller/service boundaries are generally sensible, both TypeScript configs use `strict`, and no circular Nest module dependency was found.

## 2. Security

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Supabase PostgREST bypasses all NestJS authentication and RBAC | Critical | `prisma/migrations/20260727010000_init_inventory/migration.sql:19-246`, `prisma/migrations/20260727050000_add_managed_credentials/migration.sql:1-15` | Live DB inspection found RLS disabled on all application tables and full table grants for `anon` and `authenticated`. A publishable key could read sensitive tables and directly mutate/truncate inventory outside transactions, audit logs, and guards. Read-only probes confirmed exposure. | Treat as immediate remediation: revoke all table/sequence privileges from `anon`/`authenticated`, alter default privileges, move API-only tables to a non-exposed schema or enable deny-by-default RLS, then retest every table through PostgREST. Review Supabase API logs for abuse. |
| Managed passwords were reversibly stored and returned to Admin | Resolved (was High) | `prisma/migrations/20260729010000_remove_reversible_passwords/migration.sql`, `server/src/users/users.service.ts`, `server/src/users/users.controller.ts` | Resolved: the decryptable credential table, reveal endpoint/UI, login-time password sync, and encryption key were removed. Supabase Auth is now the only password store. | Keep the replacement-password endpoint Admin-only, retain rate limiting and audit events, and never reintroduce plaintext password retrieval. |
| Auth redirects accept external destinations | Medium | `components/auth/login-form.tsx:40`, `app/auth/callback/route.ts:5-10` | User-controlled `next` is passed directly to router/URL construction. Absolute URLs can create a post-login open redirect useful for phishing. | Accept only strings beginning with one `/` and reject `//`, schemes, backslashes, and external origins; centralize a safe redirect helper. |
| Session tokens are JavaScript-accessible and frontend has no CSP | Medium | `lib/supabase/client.ts:3-8`, `lib/api.ts:9-13`, `next.config.ts:7-14`, installed `@supabase/ssr/src/utils/constants.ts:3-6` | Supabase SSR defaults to `httpOnly: false`; the browser reads the access token and adds it to Axios. Any frontend XSS can act as the user. The API has Helmet, but the Next.js frontend defines no CSP/security headers. | Prefer a BFF/server-session design with HttpOnly cookies where feasible. At minimum add a nonce/hash-based frontend CSP, Trusted Types where practical, and tests for response headers. |
| Production CORS validation is incomplete | Medium | `server/src/main.ts:17-18`, `:47-52`, `:84-91` | Production rejects localhost but still accepts `*`, plain HTTP origins, empty entries, and malformed values. | Parse every origin with `URL`; require HTTPS in production, reject wildcard/credentials conflicts, deduplicate, and fail closed. |
| Storage upload policy lacks ownership and server authorization | Medium | `components/products/product-form.tsx:94-113`; live policy `Authenticated users can upload product images` | Any authenticated role can upload to the public bucket directly, even though only Admin/Manager may manage products. The path is not tied to user/role, and no cleanup policy/code exists for orphaned images. | Upload through an authorized API or enforce role/path ownership in Storage RLS. Add controlled delete/replace cleanup and version Storage policies in migrations. |

Verified strengths: JWT signature, issuer, and audience are validated using remote JWKS (`supabase-auth.guard.ts:19-47`); global authentication and role guards are registered (`app.module.ts:42-44`); sensitive auth routes have tighter throttles; validation uses whitelist + forbid-unknown; actual secrets were not found in the working tree and `.env*` is ignored. Git history was not available.

## 3. Database & Prisma

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Public schema security invalidates database integrity guarantees | Critical | `prisma/schema.prisma:120-188`, `prisma/migrations/20260727060000_add_stock_transaction_safety/migration.sql:1-12` | Row locks, idempotency, checks, and audit writes protect NestJS operations, but direct PostgREST writes can change product quantities or records without ledger/audit synchronization. | Apply the RLS/grant remediation before accepting any inventory data as trustworthy; run reconciliation and audit for unexpected direct writes afterward. |
| Search and transaction filters lack matching indexes | Medium | `server/src/products/products.service.ts:27-44`, `server/src/search/search.service.ts:14-87`, `prisma/schema.prisma:145`, `:183` | Case-insensitive `contains` becomes `%term%` and cannot use normal B-tree name indexes. Report/status/date queries also lack a targeted `(status, transaction_date)` index. | Enable `pg_trgm` and add GIN trigram indexes for searched fields; add indexes from measured `EXPLAIN ANALYZE` plans, especially status/date. |
| Notification synchronization is query-per-user/product | Medium | `server/src/notifications/notifications.service.ts:68-89`, `:92-108`, `:123-142` | Every stock change loops over all active users with find+upsert; every notification poll loops over all low-stock products. This scales as users x alerts and runs inside stock transactions. | Use set-based `INSERT ... ON CONFLICT DO UPDATE`, queue fan-out after commit, and avoid full resync on every 30-second badge poll. |
| A migration intentionally deletes notification history | Medium | `prisma/migrations/20260727090000_add_per_user_notification_lifecycle/migration.sql:10-40` | The migration deletes all existing notifications before rebuilding active alerts. This is irreversible history loss during deployment. | Document it as a destructive migration, back up first, or migrate historical rows to per-user records without deletion. |
| Seed can reactivate and promote the bootstrap identity | Low | `prisma/seed.ts:19-42`, `docs/deployment.md:20-23` | Seed is non-destructive for business data, but production execution with bootstrap variables updates the account to ACTIVE and ADMIN. | Separate immutable role seed from one-time bootstrap admin creation and require an explicit production-only confirmation flag. |

Verified strengths: migration status matches the live schema; product quantity/cost DB checks exist; stock writes use Prisma transactions, `FOR UPDATE`, idempotency keys, and a unique reversal constraint; relations are generally normalized and Prisma includes avoid common read-side N+1 queries.

## 4. API (NestJS)

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Swagger advertises routes but DTO schemas are empty | Medium | `server/src/main.ts:58-68`, `server/src/products/dto/product.dto.ts:50-107` | Live OpenAPI contains 33 paths and a `CreateProductDto` reference, but that schema has zero properties. Responses only have status codes with empty descriptions. The document cannot be trusted as a contract. | Add `@ApiProperty`/mapped types or configure the Nest Swagger TypeScript plugin; add operation, auth, response, error, and idempotency-header documentation plus an OpenAPI snapshot test. |
| No global exception filter or request-scoped log context | Medium | `server/src/main.ts:31-45`, `server/src/common/validation-error.ts:8-15` | Only validation errors have a custom shape. Other errors use Nest defaults, and downstream service/error logs do not automatically carry request ID, user, or operation context. Aborted requests may not emit the finish log. | Add a global exception filter with stable error codes and production-safe messages; use AsyncLocalStorage or a logger context to propagate request ID and log failures/aborts. |
| Several UUID route params are not validated | Low | `server/src/products/products.controller.ts:23-25`, `server/src/categories/categories.controller.ts:17-19`, `server/src/suppliers/suppliers.controller.ts:15-16`, `server/src/users/users.controller.ts:15-22` | Invalid IDs reach Prisma/PostgreSQL rather than consistently returning a validation 400. Stock routes already demonstrate `ParseUUIDPipe`. | Apply `ParseUUIDPipe` consistently and document 400/404 responses. |
| Transaction end-date filtering excludes most of the selected day | Medium | `server/src/transactions/transactions.service.ts:15-19` | `dateTo` is parsed at midnight and used with `lte`; transactions later on the chosen date are excluded. | Convert date-only end dates to an exclusive next-day boundary (`lt nextDay`) in the business timezone and add boundary tests. |

Verified strengths: REST naming is mostly consistent; readiness performs a real DB query (`app.controller.ts:82-86`); Helmet, CORS, global validation, throttling, and shutdown hooks are enabled. Nest's default production responses do not normally expose stack traces, but stable centralized error behavior is still absent.

## 5. Frontend

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Mutation invalidation misses cross-page cache keys | Medium | `app/stock-in/page.tsx:46-52`, `app/stock-out/page.tsx:45-51`, `app/inventory-operations/page.tsx:231-235`, `app/providers.tsx:10-15` | Stock mutations do not invalidate all transaction, report, notification, and product-selector keys. Previously visited pages can show stale quantities/history for up to the default stale interval/poll cycle. | Create domain query-key factories and one shared inventory mutation invalidator covering products, all selector lists, transactions, dashboard, reports, reconciliation, and notifications. |
| Dashboard duplicates role-unaware navigation | Medium | `app/page.tsx:52-64`, `:92-127`, `components/layout/app-shell.tsx:28-78` | The embedded dashboard navigation is independent from shared role filtering and omits Operations. It can show Users to Staff and creates divergent UI behavior. | Keep one shared shell/navigation definition and render only dashboard widgets in the page. |
| Upload validation is client-only and stored URL contract differs | Medium | `components/products/product-form.tsx:94-113`, `server/src/products/dto/product.dto.ts:72-75` | Browser checks MIME/size, but API accepts arbitrary image URLs and Storage authorization is independent. Client checks are not a security boundary. | Validate host/path server-side, verify uploaded object metadata, and make product/image updates one authorized workflow. |
| Debounced searches do not pass cancellation signals | Low | `components/layout/global-search.tsx:16-25`, `lib/api.ts:9-15` | Query keys prevent old results replacing a new query, but in-flight HTTP work is not cancelled and still consumes API/DB capacity during rapid typing. | Pass TanStack Query's `AbortSignal` to Axios/fetch and apply minimum/maximum query lengths server-side. |

Verified strengths: TanStack keys include active filters, React escapes rendered data, Next Image is used for product images, remote hosts are allowlisted, and Playwright verified 11 routes at desktop/tablet/mobile. Axe found no serious/critical WCAG A/AA violations in the tested dark-mode routes.

## 6. Reports (PDFKit/ExcelJS)

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Unbounded export ranges can exhaust API memory/CPU | High | `server/src/reports/dto/report.dto.ts:3-18`, `server/src/reports/reports.service.ts:24-39`, `:62-101`, `:104-163`, `server/src/reports/reports.controller.ts:18-31` | Custom dates have no maximum span. A `daily` report buckets by hour even across years; Excel uses `writeBuffer` and PDF buffers all chunks. Global 100/min throttling is not an export resource limit. | Enforce date ordering/span limits, restrict export concurrency/rate, use streaming writers or background jobs, cap result rows, and add timeout/load tests. |
| Staff can export full inventory and value data | Medium | `server/src/reports/reports.controller.ts:10-20`, `lib/auth/permissions.ts:7-10` | Reports have authentication but no role restriction; frontend permits every role. This may expose cost/value data beyond least privilege. | Define an explicit report permission matrix; typically restrict exports/value fields to Admin/Manager and test Staff denial. |
| Returns are omitted from stock movement totals | Medium | `server/src/reports/reports.service.ts:29-36`, `prisma/schema.prisma:20-27` | Aggregates count only `STOCK_IN` and `STOCK_OUT`; confirmed `RETURN_IN`/`RETURN_OUT` movements disappear, so totals do not represent all inbound/outbound movements. | Define accounting semantics and include returns with the correct sign; retain reversal behavior and add mixed-type report fixtures. |

The current report test verifies aggregation existence and file magic bytes/size, not rendered Thai text, workbook formulas/styles, large datasets, authorization, or memory behavior.

## 7. Caching & Performance

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Adjust/return/reversal/repair never invalidate backend caches | Medium | `server/src/stock/inventory-operations.service.ts:27-30`, `:32`, `:88`, `:190`, `:226`, `:304`; compare `server/src/stock/stock.service.ts:117`, `:193`, `:253-256` | Inventory operations mutate the same data as stock in/out but do not inject or invalidate dashboard/report caches. Users can receive stale reports for 60 seconds. | Inject the shared cache or publish an inventory-changed event after successful commit for every mutation path. Add invalidation tests per operation. |
| In-memory cache is not coherent across replicas | Medium | `server/src/common/ttl-cache.service.ts:7-28`, `compose.yaml:1-18` | Cache and invalidation are process-local. Multiple API replicas can return different data until TTL expiry. Entries also have no maximum size/eviction policy. | Use Redis/shared cache with namespaced versioning or remove server caching until distributed invalidation is available; cap keys and instrument hit/miss/size. |
| Offset pagination and contains search degrade at scale | Medium | `server/src/products/products.service.ts:27-44`, `server/src/transactions/transactions.service.ts:21-35` | Large `skip` values become increasingly expensive, and `%contains%` searches scan. | Use cursor pagination for high-volume transactions/products and trigram/full-text indexes for search. |
| Notification badge polling performs synchronization work | Medium | `components/layout/notification-button.tsx:10-12`, `server/src/notifications/notifications.service.ts:13-33`, `:92-108` | A 30-second badge read can query every low-stock product and issue sequential upserts. Read traffic performs write-side reconciliation. | Separate alert generation from reads; update alerts on inventory/user events and make badge requests count-only. |

Request coalescing works for one process and correctly removes failed promises. Current tests do not verify TTL expiry, invalidation races, memory bounds, or cross-replica behavior.

## 8. Testing

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Security tests missed a live critical authorization bypass | High | `scripts/test-auth-rbac.ts:58-87`, `scripts/test-production-readiness.ts:21-24` | Tests exercise Nest endpoints and CORS only; they never probe Supabase PostgREST with the publishable key. RBAC tests pass while anonymous direct data access remains possible. | Add CI tests asserting every API-only table returns 401/403 through PostgREST and validate RLS/grants from catalog metadata. |
| No unit coverage measurement exists | Medium | `package.json:5-25`, `tsconfig.json:29-31` | There is no Jest/Vitest/coverage script, and scripts/tests are excluded from the main TypeScript build. Real line/branch coverage is unknown. | Add a unit runner and coverage thresholds for guards, date boundaries, idempotency mismatch, cache expiry/invalidation, DTOs, and report semantics. |
| Performance test mostly checks source text | Medium | `scripts/test-performance-controls.ts:8-35`, `scripts/test-production-readiness.ts:33-43` | Regex assertions prove strings exist, not that pagination/debounce/lazy loading perform correctly. The only latency test targets the trivial health route with 30 sequential requests. | Add API load tests with realistic DB data, concurrent exports/searches, p95/p99/error-rate thresholds, and browser request-count assertions. |
| Browser coverage is narrow | Medium | `e2e/inventory-workflow.spec.ts:65-124`, `playwright.config.ts:16` | Two serial Chromium tests cover login, search, notification read, stock in/out, responsive overflow, and Axe. They do not cover browser RBAC for all roles, CRUD forms, returns/reversal/reconciliation, report download contents, logout/reset, or Firefox/WebKit. | Add role-based critical journeys and at least a smaller cross-browser matrix; split fixtures to allow safe parallelism. |
| Axe gate ignores moderate/minor violations and light mode | Low | `e2e/inventory-workflow.spec.ts:157-174` | Axe runs after switching to dark mode and blocks only serious/critical findings. | Run both themes and triage all impacts, with explicit accepted exceptions rather than silently filtering them. |

Verified strength: the stock test creates real DB transactions and genuinely races two 15-unit deductions against 20 units using `Promise.allSettled` (`test-stock-concurrency.ts:139-149`), then verifies final quantity and ledger rows.

## 9. DevOps & Dependencies

| Issue | Risk Level | File/Line Reference | Problem Description | Recommended Fix |
|---|---|---|---|---|
| Production dependency advisories remain | High | `package.json:26-53`, `docs/dependency-risk.md:3-17` | Current audit reports 14 high and 1 moderate advisories through Next/sharp/PostCSS, ExcelJS/archiver, and Swagger/js-yaml. No critical advisory exists, but the release risk is real. | Track upstream fixed releases, test compatible updates promptly, and make audit/risk approval a CI/release gate. Do not use the proposed destructive `--force` downgrades blindly. |
| Workflow is CI, not CI/CD, and omits critical suites | Medium | `.github/workflows/ci.yml:15-58` | It builds and lint-checks, but does not run integration/E2E/security/audit, publish immutable images, migrate, deploy, or verify rollback. `push: false` confirms there is no delivery stage. | Add staging service credentials through environment protections, run security/integration suites, publish SHA-tagged images, deploy with approvals, migrate once, and smoke/rollback automatically. |
| Backup/restore is unverified and backup files are not ignored | Medium | `scripts/backup-database.ps1:1-15`, `scripts/restore-database.ps1:1-14`, `.gitignore:33-35`, `docs/RELEASE_CHECKLIST.md:16-17` | Scripts are plausible, but tools are absent and the restore checklist is still open. Generated `backups/` is not in `.gitignore`, increasing accidental data-commit risk. | Add `/backups/` ignore, checksum/encryption/retention, target-project confirmation, and a scheduled staging restore drill with row-count/reconciliation evidence. |
| Container artifacts are not execution-verified here | Low | `Dockerfile.frontend:1-30`, `Dockerfile.api:1-19`, `compose.yaml:1-37` | Dockerfiles are multi-stage and non-root, but Docker is unavailable locally. Compose exposes both ports, injects API secrets through `.env`, and defines no resource/read-only limits. | Build/scan images in CI, generate SBOMs, set memory/CPU limits, use platform secrets, expose only the reverse proxy, and consider read-only filesystems/tmpfs. |
| GitHub Actions are referenced by mutable major tags | Low | `.github/workflows/ci.yml:20-24`, `:40-50` | Major tags can move, increasing supply-chain uncertainty. | Pin third-party actions to reviewed commit SHAs and use Dependabot/Renovate for updates. |

Dependency freshness is otherwise reasonable: only small compatible Supabase/React patches are pending; TypeScript 7, ESLint 10, and Node type 26 are major upgrades and should be handled separately.

## Overall Summary

### Strengths

1. Stock safety is the strongest subsystem: row locks, DB constraints, idempotency, audit records, reconciliation, and real concurrency tests are present.
2. NestJS has global authentication/RBAC/throttling/validation, and JWT verification checks issuer and audience.
3. Prisma migration history is coherent with the current live database.
4. Responsive, dark-mode, and serious/critical accessibility checks run against all major routes.
5. Production builds, integration tests, and health/readiness checks currently pass.

### Most Urgent Issues

1. Critical Supabase RLS/grant exposure allows direct anonymous/authenticated data access outside NestJS.
2. Reversible password storage/reveal creates avoidable credential compromise risk.
3. Unbounded in-memory report export can cause authenticated denial of service.
4. Cache invalidation, date filtering, notification fan-out, and search/index strategy have correctness/scaling gaps.
5. CI and security tests do not cover the actual Supabase boundary, dependencies remain vulnerable, and backup/container execution is unverified.

## Priority Roadmap

1. **Immediately close Supabase PostgREST access.** Revoke grants/enable RLS or move tables to a private schema; verify with anon/authenticated probes and inspect access logs.
2. **Remove reversible passwords.** Disable reveal, migrate away from encrypted plaintext, rotate the credential key after migration, and issue one-time credentials/reset flows.
3. **Bound and authorize reports.** Restrict roles, date spans, concurrency, output rows, and memory; add return semantics and load tests.
4. **Fix correctness gaps.** Use exclusive next-day `dateTo`, invalidate all backend/frontend inventory caches, and remove the duplicate Dashboard shell.
5. **Make notifications and search scalable.** Set-based alert generation, count-only reads, trigram indexes, and cursor pagination.
6. **Harden API/frontend security.** Safe internal redirects, strict production CORS, frontend CSP, consistent UUID validation, exception filtering, and request-context logging.
7. **Strengthen CI/CD.** Add PostgREST/RLS security gates, integration/E2E/load tests, audit approval, SHA-pinned actions, signed/SBOM images, staging deployment, and rollback checks.
8. **Prove recovery and deployment.** Install tooling, build/scan containers, execute a staging backup restore, reconcile data, and record RPO/RTO evidence.
