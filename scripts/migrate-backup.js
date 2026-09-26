const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const backupDir = join(process.cwd(), "backups", "database");
mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(backupDir, `clips-${timestamp}.dump`);
const result = spawnSync(
  "pg_dump",
  ["--dbname", databaseUrl, "--format=custom", "--file", backupPath],
  { stdio: "inherit" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Database backup written to ${backupPath}`);
