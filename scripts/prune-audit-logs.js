#!/usr/bin/env node
/**
 * CLI script to prune audit logs based on the configured retention policy.
 * Run manually or via cron/scheduler:
 *   node scripts/prune-audit-logs.js [retentionDays]
 */

const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const retentionDays = parseInt(process.argv[2] || process.env.AUDIT_LOG_RETENTION_DAYS || "90", 10);

  if (isNaN(retentionDays) || retentionDays < 1) {
    console.error("Invalid retention period. Must be a positive integer.");
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  console.log(`Pruning audit logs older than ${retentionDays} days (before ${cutoff.toISOString()})...`);

  try {
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });

    console.log(`Successfully pruned ${result.count} audit log records.`);
  } catch (error) {
    console.error("Failed to prune audit logs:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
