# ADR-0004: Quarantine uploads until their content is validated

- **Status:** Accepted
- **Date:** 2026-11-23 (recorded retroactively)
- **Deciders:** ClipCash maintainers

## Context

Users upload arbitrary video files. The `Content-Type` and file extension
are supplied by the client and can be spoofed, so a renamed executable or
script could otherwise land in storage and be served from our CDN.

## Decision

Uploaded bytes are treated as **untrusted (quarantined)** until they pass
server-side validation:

- Before an upload is forwarded to storage, the server reads the first bytes
  of the payload and checks their magic-byte signature against the declared
  type (`lib/mimeSniff.ts`, used by `app/api/r2-proxy/route.ts`).
  Mismatches and known-dangerous kinds (executables, scripts) are rejected
  with `400` before anything is written.
- Upload targets are restricted to allow-listed HTTPS storage hosts
  (`*.r2.cloudflarestorage.com`, `*.r2.dev`).
- An uploaded video is only processed and published after the backend has
  accepted it; client-side MIME checks are a UX convenience, not a control.

## Consequences

- Spoofed or dangerous files never reach storage through the proxy.
- The server must buffer a small prefix (≈4 KB) of each upload before
  streaming the rest.
- New upload paths must reuse `validateMime` rather than trusting headers.

## Alternatives considered

- **Trust `Content-Type`** — trivially spoofed.
- **Full antivirus scan before storage** — too slow for multi-GB videos; may
  be added later as an asynchronous step.

## References

- `lib/mimeSniff.ts`
- `app/api/r2-proxy/route.ts`
