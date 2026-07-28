# Database Backup and Restore

Supabase-managed backups should be the primary production recovery mechanism. The project scripts provide an additional logical PostgreSQL backup for releases and recovery drills.

## Backup

Install PostgreSQL client tools, set `DIRECT_URL`, and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-database.ps1
```

The custom-format dump is written atomically under `backups/`. A SHA-256 sidecar and JSON manifest are created beside it. Partial or empty dumps are rejected, and the directory is ignored by Git.

Pruning is opt-in:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-database.ps1 -Prune -RetentionDays 30
```

Store all three files in encrypted object storage with retention and access logging. Do not commit dumps because they contain business and user data.

## Restore Drill

Always test restoration against an empty staging project first:

```powershell
$env:DIRECT_URL="postgresql://postgres.PROJECT_REF:...@.../postgres"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore-database.ps1 `
  -BackupFile backups/inventory-YYYYMMDD-HHMMSSZ.dump `
  -TargetProjectRef PROJECT_REF `
  -Force
```

The restore verifies the archive checksum, validates the archive catalog, and requires the supplied project ref to appear in the database host or user before using `--clean --if-exists --single-transaction`. This guard does not replace human approval: disable application writes and restore to staging first.

After restoration, run migrations and `npm run verify:release`. At minimum, run `test:production`, `test:auth-rbac`, `test:stock`, and `test:integrity`.

## Recovery Targets

- Define RPO and RTO with the business owner before launch.
- Run a restore drill at least quarterly and before major schema changes.
- Record backup timestamp, operator, target project, duration, row-count checks, and sign-off.
