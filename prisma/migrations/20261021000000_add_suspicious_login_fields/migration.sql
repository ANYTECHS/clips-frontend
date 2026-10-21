-- Migration: add suspicious login detection fields to UserSession
-- Adds geolocation columns (country, city, latitude, longitude) and
-- security state flags (suspicious, stepUpVerified) to support the
-- impossible-travel detector and step-up authentication challenge.

ALTER TABLE "UserSession" ADD COLUMN "country"        TEXT;
ALTER TABLE "UserSession" ADD COLUMN "city"           TEXT;
ALTER TABLE "UserSession" ADD COLUMN "latitude"       DOUBLE PRECISION;
ALTER TABLE "UserSession" ADD COLUMN "longitude"      DOUBLE PRECISION;
ALTER TABLE "UserSession" ADD COLUMN "suspicious"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSession" ADD COLUMN "stepUpVerified" BOOLEAN NOT NULL DEFAULT false;

-- Index to support efficient lookup of recent sessions by user for
-- impossible-travel comparisons (newest-first).
CREATE INDEX "UserSession_userId_createdAt_idx" ON "UserSession"("userId", "createdAt");
