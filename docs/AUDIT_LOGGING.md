# Security Audit Logging Architecture (#1162)

## Overview
ClipCash implements an append-only, tamper-evident audit logging system (Issue #1162) to record security-sensitive events across the platform. Every log entry is cryptographically chained to its predecessor using SHA-256 hashes, ensuring that retroactive modification or record deletion is immediately detectable.

---

## Log Schema & Structure

Each audit record is persisted to the `AuditLog` table with the following attributes:

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique record identifier (CUID) |
| `timestamp` | DateTime | Timestamp of event occurrence |
| `actorId` | String | ID of user, API key, or system component initiating the action |
| `actorType` | String | `user`, `api_key`, `system`, or `admin` |
| `action` | String | Dot-notated action name (e.g., `auth.login`, `api_key.create`, `session.rotate`) |
| `resource` | String | Affected entity type (`user`, `api_key`, `session`, `payment`, etc.) |
| `resourceId` | String? | ID of affected entity |
| `requestId` | String? | Request tracing ID |
| `ipAddress` | String? | Originating client IP |
| `userAgent` | String? | Originating client user agent string |
| `status` | String | Result status (`success` or `failure`) |
| `metadata` | Json? | Sanitized contextual event payload |
| `schemaVersion`| Int | Schema version (currently `1`) |
| `previousHash` | String? | SHA-256 hash of the immediate predecessor record (or `GENESIS`) |
| `eventHash` | String | SHA-256 hash over canonical representation of this record |

---

## Cryptographic Hash Chaining

### Tamper-Proof Mechanism
When writing an audit record via `createAuditLogEntry()`:
1. The most recent record is fetched to retrieve its `eventHash`.
2. If no predecessor exists, `previousHash` is set to `"0000000000000000000000000000000000000000000000000000000000000000"` (Genesis).
3. The canonical payload string is constructed from `previousHash`, `timestamp`, `actorId`, `actorType`, `action`, `resource`, `resourceId`, `status`, and sanitized `metadata`.
4. The SHA-256 hash of this canonical string forms `eventHash`.

### Integrity Verification
Integrity can be verified on-demand via `verifyAuditLogIntegrity()` or via `GET /api/audit-logs/verify`:
- Scans all records sequentially in ascending timestamp order.
- Re-computes each `eventHash` and validates that `record.previousHash === predecessor.eventHash`.
- Pinpoints the exact record ID and expected vs. actual hash if tampering or deletion has occurred.

---

## Redaction of Sensitive Data

To prevent credential leakage into audit logs, `sanitizeAuditMetadata()` recursively scrubs the following keys and patterns:
- `password`, `token`, `secret`, `key`, `apiKey`, `jwt`, `creditCard`, `authorization`
- Replaces values with `"[REDACTED]"`.

---

## Retention Policy & Scheduled Pruning

Audit logs must be retained for compliance, but older records beyond the retention threshold should be archived or pruned.

- **Default Retention Period:** 90 days (configurable via `AUDIT_LOG_RETENTION_DAYS`).
- **Pruning CLI Script:** `node scripts/prune-audit-logs.js` (or `npm run audit:prune`).
- **Options:**
  - `--days <N>`: Custom retention window.
  - `--dry-run`: View records eligible for pruning without deleting.
