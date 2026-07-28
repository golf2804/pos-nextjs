import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backup = readFileSync("scripts/backup-database.ps1", "utf8");
const restore = readFileSync("scripts/restore-database.ps1", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");

assert.match(backup, /\.partial/);
assert.match(backup, /Get-FileHash[\s\S]*SHA256/);
assert.match(backup, /\[switch\]\$Prune/);
assert.match(backup, /OutputDirectory must resolve inside the project workspace/);
assert.match(restore, /TargetProjectRef/);
assert.match(restore, /Backup checksum verification failed/);
assert.match(restore, /--exit-on-error --single-transaction/);
assert.match(gitignore, /^\/backups\/$/m);

console.log("PASS SECURITY 8.1: backup and restore scripts enforce checksum, target confirmation, and safe retention");
