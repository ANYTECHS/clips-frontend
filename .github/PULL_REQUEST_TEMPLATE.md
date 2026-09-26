<!-- Title: use Conventional Commits, e.g. "feat(upload): resume chunked uploads". It becomes the squash-merge commit message. -->

## What & why

<!-- What does this PR change, and why? -->

Closes #

## How to test

<!-- Steps a reviewer can follow to verify the change. -->

1.

## Screenshots / recording

<!-- Required for UI changes: before/after. Delete this section otherwise. -->

## Checklist

- [ ] Linked the issue I was assigned
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm run test` pass locally
- [ ] Added or updated tests (bug fixes include a test that fails without the fix)
- [ ] Added a changeset (`npm run changeset`, or `npm run changeset -- --empty` for docs/internal changes)
- [ ] UI: added or updated `*.stories.tsx`, `npm run build-storybook` passes, and the a11y panel is clean
- [ ] Security: user-controlled strings go through `sanitize()`, no secrets committed, no secrets in `NEXT_PUBLIC_*`
- [ ] Env vars: updated `.env.example` and `docs/ENVIRONMENT_VARIABLES.md` (or N/A)
- [ ] Architecture docs updated: `docs/ARCHITECTURE.md` (or N/A)
