# Contributing to ClipCash

Thanks for wanting to contribute — we appreciate it! This document explains how to get the project running locally, the conventions we follow, and guidelines for PRs and issue triage.

**Contents**
- Prerequisites
- Local setup
- Environment variables
- Running tests & Storybook
- Code standards & security
- CSS naming conventions (BEM)
- Pull request guidelines
- Issue triage

## Prerequisites
- Node.js 18+ (LTS recommended)
- npm (or yarn) installed
- Git

## Local setup
1. Clone the repo and install dependencies

```bash
git clone https://github.com/ANYTECHS/clips-frontend.git
cd clips-frontend/clips-frontend
npm install
```

2. Copy environment template and edit values

```bash
cp .env.example .env.local
# then edit .env.local to match your environment
```

3. Run the development server

```bash
npm run dev
```

Open http://localhost:3000 to view the app.

## Environment variables
We keep an `.env.example` at the repository root. Copy it into this directory before running the app:

```bash
cp ../.env.example .env.local
```

Required variables (OAuth, NextAuth, Sentry) and optional variables (Stellar contracts, analytics, extra providers) are documented in that file. CI runs a startup check that fails the build when required variables are missing.

## Running tests & Storybook
- Unit tests (Jest): `npm run test`
- E2E tests (Playwright): `npm run test:e2e`
- Storybook (dev): `npm run storybook`
- Build Storybook: `npm run build-storybook`

CI may run linters, tests and Storybook builds — ensure these pass locally before opening a PR.

## Changesets workflow
This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR should include a changeset describing the change and its semver impact.

### Adding a changeset
When working on a PR, run the changeset command to document your changes:

```bash
npm run changeset
```

You'll be prompted to:
1. Select the package (this is a single-package project, so select the only option)
2. Choose the version bump type:
   - `major` for breaking changes
   - `minor` for new features
   - `patch` for bug fixes
3. Write a summary of your changes

This creates a `.changeset/*.md` file that should be committed with your PR.

### CI enforcement
The CI workflow checks that feature PRs include a changeset. If your PR is missing a changeset, the CI will fail. For documentation-only changes or internal refactors that don't affect the published package, you can add an empty changeset with the `--empty` flag:

```bash
npm run changeset -- --empty
```

### Versioning and releases
When you're ready to release a new version:
1. Run `npm run changeset version` to consume changesets and update `package.json`
2. Run `npm run changeset publish` to publish to npm (if applicable)
3. The changelog is automatically generated from the consumed changesets

## Code standards & security
- Follow the existing code style (TypeScript + Next.js + Tailwind). Run `npm run lint` to catch lint issues.
- For security & sanitization guidance see [AGENTS.md](clips-frontend/AGENTS.md) — apply the sanitization rules, input validation, and secrets handling described there.
- Review the threat model and reporting process in [docs/SECURITY.md](docs/SECURITY.md) before shipping security-sensitive changes.
- Never commit secrets or private keys. `.env.local` is ignored by git.
- Use native Web Crypto APIs for local encryption when applicable (see project docs).

### Avoiding nested ternaries
Nested ternary operators (`a ? b : c ? d : e`) are hard to read and easy to get wrong. Prefer explicit `if`/`else` statements (or early returns) over chained ternaries.

```ts
// Bad: nested ternary
const label = isLoading ? 'Loading…' : hasError ? 'Error' : 'Ready';

// Good: if/else
let label: string;
if (isLoading) {
  label = 'Loading…';
} else if (hasError) {
  label = 'Error';
} else {
  label = 'Ready';
}
```

A single, non-nested ternary used for a simple value selection is fine. When a ternary would need to be nested, refactor it into `if`/`else` statements or a small helper function. The ESLint config enforces this with the `no-nested-ternary` rule; run `npm run lint` before opening a PR and fix any violations rather than disabling the rule inline.

## CSS naming conventions (BEM)
We use **BEM** (Block, Element, Modifier) for all CSS class names to keep styles predictable and collision-free. This applies to custom CSS, CSS Modules, and any non-utility class names (Tailwind utility classes are exempt).

### Format
```
block__element--modifier
```
- **Block**: standalone component, e.g. `card`, `navbar`, `clip-player`
- **Element**: part of a block, joined with `__`, e.g. `card__title`, `navbar__logo`
- **Modifier**: variation/state, joined with `--`, e.g. `card--featured`, `button--disabled`

### Rules
- Use lowercase `kebab-case` for multi-word names: `clip-player__play-button`.
- Elements and modifiers are always scoped to their block — never use bare element names like `title` or `button`.
- Do not nest elements (`block__element__sub`); create a new block instead.
- Avoid chaining modifiers (`block--a--b`); compose with separate classes.
- Keep class names semantic, not presentational (`card__title`, not `card__big-text`).

### Examples
```html
<!-- Good -->
<div class="card card--featured">
  <h2 class="card__title">Clip</h2>
  <button class="card__action card__action--primary">Play</button>
</div>

<!-- Bad -->
<div class="featuredCard">
  <h2 class="cardTitle">Clip</h2>
  <button class="primaryActionButton">Play</button>
</div>
```

### Linting
A Stylelint rule enforces the BEM pattern for custom class names. Run `npm run lint` (or `npm run lint:css` if configured) before opening a PR; violations must be fixed rather than disabled inline unless there is a documented exception.

## Pull request guidelines
- Branch naming
  - Feature branches: `feature/<short-description>` or `feature/<issue-number>-short-description`
  - Bugfix branches: `fix/<issue-number>-short-description`
  - Hotfixes: `hotfix/<short-description>`

- Commit message format
  - Use clear, imperative messages. We recommend Conventional Commits (optional but preferred):
    - `feat(scope): describe feature`
    - `fix(scope): describe fix`
    - `chore: misc changes`

- PR checklist
  - Link to the issue (if any)
  - Describe what changed and why
  - Ensure `npm run lint` passes
  - Add tests where applicable
  - Run `npm run test` and `npm run build` locally
  - Confirm Storybook builds if you changed UI components
  - Confirm new/renamed CSS classes follow the BEM convention above

- Required checks
  - At minimum, ensure lint and unit tests pass locally. The repository uses a Storybook GitHub Actions workflow for Storybook deployment; other CI checks (lint/tests) may be added — ensure your branch satisfies the repository's configured checks before merging.

## Issue triage / picking up work
1. Browse existing issues and look for ones labelled `good first issue` or `help wanted`.
2. Comment on the issue to say you intend to work on it. Include your GitHub username and a short plan.
3. If maintainers confirm, create a branch and start working. Link the PR to the issue using `Fixes #<issue>` when appropriate.
4. If an issue needs clarification, ask questions in the issue; provide screenshots, logs, and steps to reproduce if you need help reproducing a bug.
5. Tag maintainers or use repository-specific labels if you need an expedited review.

## Questions and support
If you have questions, make a note in the issue or open a new one titled `help wanted:` followed by a short description. For PR review help, mention `@ANYTECHS` maintainers in a comment.

## Adding new locales (i18n)
The project uses a custom i18n system located in `app/lib/i18n/`. To add a new locale:
1.  **Define the locale type**: Add the new locale code (e.g., `de`, `it`) to the `Locale` type in `app/lib/i18n/types.ts`.
2.  **Create translation file**: Create a new JSON file in `app/lib/i18n/locales/` (e.g., `de.json`). Use `en.json` as a template and ensure all keys are translated.
3.  **Register the translation**: Import the new JSON file in `app/lib/i18n/translations.ts` and add it to the `translations` object.
4.  **Update the Provider**: Add the new locale to the `AVAILABLE_LOCALES` array in `app/lib/i18n/I18nProvider.tsx`. Update the `useEffect` hook that restores the locale from `localStorage` to include the new code.
5.  **Add tests**: Extend `__tests__/lib/i18n.test.ts` to verify that the new locale is correctly loaded and falls back to English for missing keys.

Thanks again — contributions make ClipCash better for everyone!