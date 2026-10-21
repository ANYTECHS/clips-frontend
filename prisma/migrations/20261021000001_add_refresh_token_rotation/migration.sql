-- Migration: add refresh token rotation table for JWT rotation with reuse detection.
-- Each row stores the SHA-256 hash of an opaque refresh token (never the plaintext),
-- a familyId linking all tokens in one rotation chain, and a replacedByHash so the
-- full chain is auditable.  Revocation of an entire family (on reuse detection) is a
-- single UPDATE WHERE familyId = $1.

CREATE TABLE "RefreshToken" (
  "id"             TEXT         NOT NULL,
  "userId"         TEXT         NOT NULL,
  "tokenHash"      TEXT         NOT NULL,
  "familyId"       TEXT         NOT NULL,
  "replacedByHash" TEXT,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "revokedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- Unique constraint so a hash cannot be inserted twice
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- Fast lookup by userId (list all tokens for a user)
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- Fast family revocation (revoke all tokens in a family on reuse detection)
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- Covered index for hash lookups (the hot path on every refresh)
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");

-- TTL cleanup index (periodic job deletes expired tokens WHERE expiresAt < now())
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- Foreign key: cascade delete when the user is deleted
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
