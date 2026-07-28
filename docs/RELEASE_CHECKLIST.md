# Release Checklist

Automated verification last completed: 2026-07-29

## Quality Gate

- [ ] `npm ci` completes from a clean checkout.
- [ ] `npm run verify` passes from the release commit.
- [ ] `npm run verify:integration` passes against the dedicated Supabase integration project.
- [ ] `npm run verify:release` passes and its CI run is linked in the release record.
- [x] `npm audit --omit=dev` is reviewed; critical vulnerabilities are zero and accepted residual advisories are documented in [dependency-risk.md](./dependency-risk.md).
- [x] Desktop, tablet, mobile, light mode, dark mode, and WCAG serious/critical checks pass in Playwright.
- [ ] PDF and Excel exports open correctly with representative Thai and English data.

## Data and Security

- [ ] Production migration was reviewed and tested on a restored staging backup.
- [ ] A fresh pre-release backup, SHA-256, and manifest exist and its restore was verified in staging.
- [ ] Supabase public sign-up is disabled and Storage policies allow only intended image operations.
- [ ] `SUPABASE_SECRET_KEY`, database URLs, and credential encryption key exist only in the secret manager.
- [ ] `FRONTEND_URL` and CORS contain only production HTTPS origins.
- [ ] Swagger is disabled publicly or protected by an internal access layer.
- [ ] Admin, Manager, and Staff permissions were manually sampled.

## Deployment

- [ ] Frontend and API images were built once and tagged with the commit SHA.
- [ ] Prisma migrations completed before new API traffic was enabled.
- [x] `/api/health` and `/api/health/ready` return HTTP 200 in the configured verification environment.
- [ ] Structured logs and `X-Request-Id` appear in the monitoring platform.
- [ ] Alerts exist for API errors, readiness failures, latency, and database capacity.
- [ ] HTTPS, security headers, CORS, and reverse-proxy rate limits were verified externally.

## Smoke Test

- [ ] Managed Admin can log in and log out.
- [ ] Global Search finds a known SKU.
- [x] Product, Category, and Supplier CRUD work for an authorized role.
- [x] Stock In updates quantity and weighted average cost.
- [x] Stock Out prevents negative inventory.
- [x] Transactions, dashboard, notifications, and reports reflect the movement.
- [x] Password reset request and Admin-managed reset work without exposing account existence.

## Sign-Off

- [ ] Product owner accepted the release in staging.
- [ ] Release owner approved dependency residual risk and rollback plan.
- [ ] Backup location, image tags, migration version, and release timestamp were recorded.
- [ ] Monitoring was observed during the post-release window.

## Evidence

- [ ] Record CI run URL and commit SHA.
- [ ] Record backup filename, checksum, staging project ref, restore duration, and integrity-test output.
- [ ] Record dependency audit date and accepted residual advisories.
- [ ] Record p95 smoke-test result and the monitoring dashboard link.
