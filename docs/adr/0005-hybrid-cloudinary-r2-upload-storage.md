# ADR-0005: Hybrid upload storage — Cloudinary for small files, R2 for large

- **Status:** Accepted
- **Date:** 2026-11-23 (recorded retroactively)
- **Deciders:** ClipCash maintainers

## Context

Cloudinary gives us transformations and a CDN for clips and thumbnails, but
its upload limits and pricing make it a poor fit for very large source
videos. Routing large files through the Next.js proxy
([ADR-0001](0001-single-nextjs-app-with-api-proxy.md)) would also tie up
server resources.

## Decision

`lib/uploadToStorage.ts` picks the storage provider by file size:

- Files **below 95 MB** (`HYBRID_UPLOAD_THRESHOLD_BYTES`) upload to
  **Cloudinary**.
- Files **95 MB and above** upload directly from the browser to
  **Cloudflare R2** using a pre-signed URL, up to the 1 GB client limit
  (`MAX_VIDEO_FILE_SIZE_BYTES`).
- If the browser origin is rejected by R2's CORS policy, the upload falls
  back to the streaming `app/api/r2-proxy` route, which validates content
  first ([ADR-0004](0004-quarantine-uploads-until-validated.md)).

## Consequences

- Large uploads avoid both Cloudinary limits and the Next.js proxy.
- Two storage providers must be configured, monitored and paid for; the
  result records `storageProvider` so downstream code knows where a file
  lives.

## Alternatives considered

- **Cloudinary only** — size limits and cost for large sources.
- **R2 only** — loses Cloudinary's transformations and CDN for clips.

## References

- `lib/uploadToStorage.ts`
- `lib/uploadToCloudinary.ts`
- `app/api/r2-proxy/route.ts`
