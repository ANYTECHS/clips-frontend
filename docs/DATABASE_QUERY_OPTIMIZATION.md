# Database Query Optimization

The first indexed production path is notification listing. It filters by `userId`, unread state, and newest records first, so the migration adds:

- `Notification_userId_readAt_createdAt_idx`
- `Notification_userId_createdAt_idx`

Use `npm run complexity` for code complexity monitoring and database query review for new list endpoints. Set `COMPLEXITY_STRICT=true` to fail on findings. For new Prisma-backed lists, prefer indexed filter columns plus stable ordering columns.
