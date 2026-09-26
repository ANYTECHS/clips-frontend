BEGIN;

DROP INDEX IF EXISTS "Notification_userId_createdAt_idx";
DROP INDEX IF EXISTS "Notification_userId_readAt_createdAt_idx";

COMMIT;
