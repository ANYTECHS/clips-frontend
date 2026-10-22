-- Issue #1174: composite indexes for hot query paths
CREATE INDEX IF NOT EXISTS "ApiUsage_apiKeyId_createdAt_idx" ON "ApiUsage"("apiKeyId", "createdAt");
CREATE INDEX IF NOT EXISTS "EarningsReportDelivery_status_createdAt_idx" ON "EarningsReportDelivery"("status", "createdAt");
