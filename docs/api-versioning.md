# API Versioning Policy

Issue: #1395 — Enforce API versioning on all routes

## Versioning scheme

- All public ClipCash backend API routes live under the versioned namespace: `/api/v1/*`.
- The version is part of the path (`/api/v1/<resource>`), not a header or query param.
- Unversioned paths (for example `/videos`, `/clips`) are deprecated and must not be
  used by new integrations. Clients should migrate to the versioned namespace.

## Deprecation behaviour

- Unversioned requests are answered with a deprecation notice (`Deprecation` /
  `Warning` headers or a redirect to the versioned equivalent) while the legacy
  surface is phased out.
- Breaking changes ship under a new version; the previous version keeps serving the
  deprecated surface until removal.

## Client migration checklist

1. Switch base URLs from `https://<backend>` to `https://<backend>/api/v1`.
2. Update every endpoint path to include the version prefix.
3. Handle version-specific error envelopes (`{ error, statusCode }`).
4. Pin the API version explicitly in server configuration so deploys are auditable.

## Related API guidelines

- Pagination metadata: list endpoints return `{ data, pagination: { nextCursor, hasMore, total? } }` — see [`API.md`](./API.md#pagination).
- Idempotency: unsafe methods accept an `Idempotency-Key`; keys are scoped per
  operation and expire after 24h.
- Caching: safe GET responses may carry an `ETag`; clients should send
  `If-None-Match` and honour `304 Not Modified`.
