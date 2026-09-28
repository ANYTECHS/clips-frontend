# API Authentication Architecture (#1164)

## Overview
This document describes the unified API authentication system in ClipCash (`ANYTECHS/clips-frontend`), implementing Issue #1164. The system provides secure, token-based and key-based access to API endpoints with granular permissions, tamper detection, and comprehensive auditability.

---

## Authentication Schemes

The API supports three authentication mechanisms via `authenticateApiRequest()` and `withApiAuth()`:

### 1. API Keys (`ck_live_...` / `ck_test_...`)
- **Key Format:** Prefixed random string `ck_<env>_<32-byte-hex>` (e.g., `ck_live_9f8a...`).
- **Header Formats Supported:**
  - `Authorization: Bearer ck_live_...`
  - `Authorization: Api-Key ck_live_...`
  - `X-API-Key: ck_live_...`
- **Storage Security:** Raw keys are **never** stored in plaintext.
  - The first 8 characters (`keyPrefix`) are stored for rapid identification and support UI.
  - The SHA-256 cryptographic hash (`keyHash`) is stored uniquely and indexed in the database.
  - Lookups hash the incoming key with SHA-256 and query by `keyHash`.
- **Scopes & Permissions:** Granular scopes (e.g., `read`, `write`, `admin`, `videos:read`) or wildcard `*`.
- **Revocation & Expiration:** Revoked keys (`active: false` or `revokedAt: Date`) and expired keys (`expiresAt < now`) are immediately rejected.
- **Usage Metrics:** Last used timestamp and request metrics (`ApiUsage` model) are recorded asynchronously.

### 2. JSON Web Tokens (JWT)
- **Algorithm:** Cryptographically signed HMAC-SHA256 (`HS256`).
- **Secret Resolution:** Uses `API_JWT_SECRET` (fallback to `NEXTAUTH_SECRET`).
- **Header Format:** `Authorization: Bearer <jwt-token>`
- **Token Claims:**
  - `sub`: User ID
  - `email`: User email address
  - `role`: Role (`user`, `admin`, etc.)
  - `scopes`: Allowed permission scopes (array)
  - `exp`: Expiration timestamp (seconds since Unix epoch)
  - `iat`: Issued-at timestamp
  - `jti`: Unique token identifier
- **Verification:** Cryptographic signature verification, constant-time timing-safe HMAC equality check, expiration enforcement, and schema validation.

### 3. Browser Session Fallback (Optional)
- Opt-in for API routes consumed by both external clients and internal frontend:
  ```ts
  const auth = await authenticateApiRequest(req, { allowSession: true });
  ```

---

## Usage in Route Handlers

### Higher-Order Function (`withApiAuth`)
Wrap route handlers to automatically enforce authentication and authorization scopes:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/api/lib/apiAuth";

export const GET = withApiAuth(
  async (req: NextRequest, authContext) => {
    return NextResponse.json({
      message: "Access granted",
      userId: authContext.user?.id,
      authType: authContext.authType,
    });
  },
  { requiredScope: "read" }
);
```

### Direct Invocation (`authenticateApiRequest`)
For customized response handling:

```ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/app/api/lib/apiAuth";

export async function POST(req: NextRequest) {
  const authResult = await authenticateApiRequest(req, {
    requiredScope: "write",
    allowSession: true,
  });

  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.statusCode || 401 }
    );
  }

  // Handle authenticated request
  return NextResponse.json({ ok: true });
}
```

---

## Monitoring and Security Auditing
- **Failed Authentication Logging:** All failed attempts (invalid key, expired token, missing permissions, invalid signatures) are recorded via `logAuthFailure()` with redacted inputs, client IP, path, and failure reason.
- **Audit Trails:** Key generation and key deletion/revocation automatically create tamper-evident `AuditLog` records.
