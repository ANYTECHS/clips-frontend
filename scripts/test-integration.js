#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error("Set TEST_DATABASE_URL to a disposable PostgreSQL test database.");
  process.exit(1);
}

const databaseName = new URL(databaseUrl).pathname.slice(1).toLowerCase();
if (!/(^|[_-])(test|testing|ci)([_-]|$)/.test(databaseName)) {
  console.error(`Refusing to reset database '${databaseName}': its name must identify a test database.`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" };
const commands = [
  ["prisma", ["migrate", "reset", "--force", "--skip-seed"]],
  ["jest", ["--config=jest.integration.config.js", "--runInBand"]],
];

for (const [command, args] of commands) {
  const result = spawnSync("npx", [command, ...args], { env, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
