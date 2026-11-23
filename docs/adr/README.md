# Architecture Decision Records

This directory is the versioned log of significant design decisions for
ClipCash. Each record explains **why** something is the way it is, so that
later changes can revisit the reasoning instead of guessing at it.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-single-nextjs-app-with-api-proxy.md) | Single Next.js app with a same-origin API proxy | Accepted |
| [0002](0002-httponly-cookie-sessions-with-csrf.md) | HTTP-only JWT cookie sessions with double-submit CSRF tokens | Accepted |
| [0003](0003-redis-with-graceful-fallback.md) | Redis for shared state, with graceful fallback when it is down | Accepted |
| [0004](0004-quarantine-uploads-until-validated.md) | Quarantine uploads until their content is validated | Accepted |
| [0005](0005-hybrid-cloudinary-r2-upload-storage.md) | Hybrid upload storage: Cloudinary for small files, R2 for large | Accepted |

## Writing a new ADR

1. Copy [`template.md`](template.md) to `NNNN-short-title.md`, using the next
   free number.
2. Fill in Context, Decision and Consequences. Set the status to `Proposed`.
3. Add a row to the index above and open a pull request; the ADR becomes
   `Accepted` when the PR is merged.
4. Never rewrite an accepted ADR to change the decision. Write a new ADR and
   mark the old one `Superseded by ADR-XXXX`.
