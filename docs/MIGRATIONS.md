# Database Migrations

Run migrations with:

```bash
npm run migrate:deploy
```

Before production changes, create a database backup with:

```bash
DATABASE_URL="postgresql://..." npm run migrate:backup
```

Backups are written to `backups/database/` as timestamped custom-format `pg_dump` files.

Every migration directory must include non-empty `migration.sql` and `rollback.sql` files. Validate them and the Prisma schema with:

```bash
npm run migrate:test
```

Rollback a specific applied migration:

```bash
npm run migrate:rollback -- 20260925000000_add_notification_indexes
```

The rollback command executes `rollback.sql` and marks the migration as rolled back in Prisma's migration history. Create and verify a backup before every production rollback.
