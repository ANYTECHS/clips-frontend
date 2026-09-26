---
"clipsproject": minor
---

Add bulk delete and archive for clips, dynamic Open Graph images, verified robots/sitemap coverage, and a split Dependabot policy.

- `DELETE /api/clips` soft-deletes clips (`deletedAt`) and `PATCH /api/clips/archive` archives them (`archivedAt`); both are exposed from `SelectionFooter`, with deletion gated behind a confirmation.
- Projects page gains an "Archived" filter tab.
- `/api/og` generates 1200×630 Open Graph images; the share page emits dynamic OG/Twitter tags built from the clip's title, score, and thumbnail.
- `robots.ts` now disallows every `(dashboard)` route including `/billing`, `/analytics`, and `/referral`; `sitemap.ts` covers the public share section.
- Dependabot splits patch (weekly, auto-approved) from minor (monthly, manual), grouped by `@stellar/*`, `@sentry/*`, `@storybook/*`, and `@testing-library/*`; CI verifies the lockfile with `npm ci --dry-run`.
