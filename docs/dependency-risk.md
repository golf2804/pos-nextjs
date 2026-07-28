# Dependency Risk Register

Last reviewed: 2026-07-29

`npm audit --omit=dev --audit-level=moderate` currently reports 15 production advisories: 14 high and 1 moderate, with no critical findings.

## Accepted Residual Advisories

| Dependency path | Exposure in this application | Current mitigation |
| --- | --- | --- |
| `exceljs -> archiver/glob/minimatch/brace-expansion/uuid` | Server-side Excel generation; user input is converted to report rows and is not used as a glob pattern or UUID output buffer. | Reports require authentication and rate limiting. Keep exports resource-limited and upgrade when ExcelJS releases a compatible dependency chain. |
| `@nestjs/swagger -> js-yaml` | OpenAPI document generation at API startup; the application does not parse user-provided YAML. | Swagger defaults to disabled in production. Enable it only behind an internal access layer. |
| `next -> postcss/sharp` | Build-time CSS processing and server-side image optimization. | Only allowlisted Supabase image hosts are accepted. Deploy behind request/body limits and apply the first compatible Next.js patch containing fixed transitive versions. |

## Upgrade Decision

`npm audit fix` was applied. The remaining suggested `npm audit fix --force` plan attempts incompatible downgrades such as Next.js 9 and ExcelJS 3, so it is not approved. Re-run the audit on every CI build and review this register before each release.

CI runs `npm run security:dependencies` and blocks critical production advisories. High and moderate advisories require review in this register because forcing transitive upgrades can introduce larger runtime regressions. The local advisory count must be refreshed with explicit approval because `npm audit` sends the dependency graph to the npm registry.
