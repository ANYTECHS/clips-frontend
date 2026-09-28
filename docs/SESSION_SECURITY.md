# Session Security and Lifecycle Architecture (#1163)

## Overview
ClipCash implements robust session security (Issue #1163) to defend against session hijacking, fixation, stale sessions, and unauthorized concurrent logins.

---

## Secure Cookie Configuration

Session cookies are configured with defense-in-depth security attributes:

| Attribute | Production | Development / Testing | Purpose |
|---|---|---|---|
| `HttpOnly` | `true` | `true` | Prevents access by malicious client-side JavaScript (mitigating XSS session theft). |
| `SameSite` | `lax` | `lax` | Protects against Cross-Site Request Forgery (CSRF). |
| `Secure` | `true` | `false` | Requires HTTPS in production while allowing local HTTP development. |
| `Path` | `/` | `/` | Standard application-wide scope. |
| Name | `__Secure-authjs.session-token` (prod) | `authjs.session-token` (dev) | Uses `__Secure-` cookie prefix in production for browser-enforced HTTPS. |

---

## Session Timeout & Inactivity Rules

1. **Absolute Session Expiration (`SESSION_MAX_AGE`):**
   - Configurable via `SESSION_MAX_AGE` env var (default: 86,400 seconds / 24 hours).
   - Once a session reaches this age, it is terminated regardless of ongoing activity.
2. **Inactivity Timeout (`SESSION_INACTIVITY_TIMEOUT`):**
   - Configurable via `SESSION_INACTIVITY_TIMEOUT` env var (default: 1,800 seconds / 30 minutes).
   - If no requests are received within the inactivity window, the session expires and the user must re-authenticate.

---

## Token and Session Rotation

To protect against session fixation attacks:
- `rotateSession(oldToken)` generates a cryptographically random session token (using Web Crypto API).
- Automatically updates the server-side `UserSession` record and invalidates the old token.
- Logs an audit event (`session.rotate`).

---

## Concurrent Session Management

To prevent account sharing and unauthorized parallel access:
- **Maximum Concurrent Sessions (`MAX_CONCURRENT_SESSIONS`):** Default: 5 sessions per user.
- **Eviction Policy:** When a user logs in and exceeds the limit, `enforceConcurrentSessionLimit(userId)` revokes the oldest active session (`revokedAt = new Date()`), ensuring the active session count never exceeds the ceiling.
- **Session Introspection & Revocation API:**
  - `GET /api/auth/sessions`: Lists the current user's active devices and sessions (with IP, user agent, last activity, expiration).
  - `DELETE /api/auth/sessions/[id]`: Immediately revokes a specific session.
