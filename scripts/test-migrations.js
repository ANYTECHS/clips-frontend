const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const migrations = existsSync(migrationsDir)
  ? readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  : [];
const invalid = [];

for (const migration of migrations) {
  for (const fileName of ["migration.sql", "rollback.sql"]) {
    const filePath = join(migrationsDir, migration.name, fileName);
    if (!existsSync(filePath) || !readFileSync(filePath, "utf8").trim()) {
      invalid.push(`${migration.name}/${fileName}`);
    }
  }
}

if (invalid.length > 0) {
  console.error(`Invalid migration files: ${invalid.join(", ")}`);
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["prisma", "validate", "--schema", "prisma/schema.prisma"], {
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://migration-test:password@localhost:5432/migration_test",
  },
  stdio: "inherit",
});

console.log(`Validated ${migrations.length} migration(s).`);
