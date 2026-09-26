const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const migrationName = process.argv[2] ?? process.env.MIGRATION_NAME;

if (!migrationName) {
  throw new Error("Pass the migration directory name to roll back.");
}

const migrationDir = join(migrationsDir, migrationName);
const rollbackPath = join(migrationDir, "rollback.sql");

if (!existsSync(rollbackPath)) {
  throw new Error(`Missing rollback file: ${rollbackPath}`);
}

const sql = readFileSync(rollbackPath, "utf8").trim();
if (!sql) {
  throw new Error(`Rollback file is empty: ${rollbackPath}`);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
});
execFileSync(
  npx,
  [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    migrationName,
    "--schema",
    "prisma/schema.prisma",
  ],
  { stdio: "inherit" }
);
console.log(`Rolled back ${migrationName}.`);
