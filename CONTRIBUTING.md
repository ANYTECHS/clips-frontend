# Contributing to ClipCash

Thanks for wanting to contribute! This guide takes you from a fresh clone to a merged PR.

## Contents

1. [Onboarding: your first day](#1-onboarding-your-first-day)
2. [Development setup](#2-development-setup)
3. [Finding something to work on](#3-finding-something-to-work-on)
4. [Contribution guidelines](#4-contribution-guidelines)
5. [Opening a pull request](#5-opening-a-pull-request)
6. [Code review process](#6-code-review-process)
7. [Changesets](#7-changesets)
8. [Communication](#8-communication)
9. [Recipes](#9-recipes)

---

## 1. Onboarding: your first day

ClipCash is a Next.js 16 app. Creators upload long videos, an AI backend finds short "clip moments", and creators publish or mint those clips on Stellar. The UI and the API routes live in this one repository.

Read these in order:

| # | Read | Why |
| --- | --- | --- |
| 1 | [README.md](README.md) | What the product does and the main scripts |
| 2 | [docs/ARCHITECTURE.md §0 System Overview](docs/ARCHITECTURE.md#0-system-overview) | The big picture, diagrams and the directory map |
| 3 | [AGENTS.md](AGENTS.md) | **Mandatory rules:** Next.js 16 differences, sanitization, no public demo pages |
| 4 | [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) | What to put in `.env.local` |
| 5 | [STORYBOOK.md](STORYBOOK.md) | How we build and document UI components |
| 6 | [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) | How to write and run tests |
| 7 | [docs/TYPESCRIPT_STANDARDS.md](docs/TYPESCRIPT_STANDARDS.md), [docs/naming-conventions.md](docs/naming-conventions.md), [docs/FORMATTING_STANDARDS.md](docs/FORMATTING_STANDARDS.md) | Code conventions |
| 8 | [docs/SECURITY.md](docs/SECURITY.md) | Threat model, CSP and security headers |

Then do this first-day checklist:

- [ ] Get the app running locally ([§2](#2-development-setup)).
- [ ] Open Storybook and click through a few components.
- [ ] Run `npm run test` and see it pass.
- [ ] Pick an issue from the [good first issues](#31-good-first-issues) list and comment on it.

> ⚠️ **This is not the Next.js from your training data or old tutorials.** Next.js 16 changed APIs and conventions. Before writing framework code, check the docs bundled at `node_modules/next/dist/docs/`.

---

## 2. Development setup

### 2.1 Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **20.9+** (current LTS recommended) | Next.js 16 and Storybook 10 do not run on Node 18. CI uses `lts/*`. |
| npm | Comes with Node | The project uses `package-lock.json`. Use `npm ci`, not `yarn` or `pnpm`. |
| Git | Any recent version | |
| Docker | Optional | Only needed for a local Redis, Postgres or ClamAV. |

### 2.2 Install and run

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/clips-frontend.git
cd clips-frontend
git remote add upstream https://github.com/ANYTECHS/clips-frontend.git

# 2. Install dependencies (this also installs the husky git hooks)
npm ci

# 3. Create your local env file
cp .env.example .env.local
#    Fill in the [REQUIRED] values. See docs/ENVIRONMENT_VARIABLES.md.
#    Missing values only log a warning in dev; the server still starts.

# 4. Start the dev server
npm run dev              # http://localhost:3000
```

### 2.3 Optional local services

You don't need any of these to work on the UI. Add them when your task needs them:

```bash
# Redis: shared job store (otherwise an in-memory store is used)
docker run -d --name clips-redis -p 6379:6379 redis:7
#   then in .env.local: REDIS_URL=redis://localhost:6379

# PostgreSQL: users and notifications (Prisma)
docker run -d --name clips-pg -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_USER=user -e POSTGRES_DB=clips postgres:16
npx prisma migrate dev
```

### 2.4 Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run storybook` | Component explorer at <http://localhost:6006> |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier (**CI runs `format:check`**) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Jest unit tests |
| `npm run test:integration` | Jest integration tests |
| `npm run test:e2e` | Playwright end-to-end tests (`npx playwright install` the first time) |
| `npm run test:a11y` | Accessibility tests |
| `npm run build` | Production build plus performance-budget check |
| `npm run build-storybook` | Static Storybook build |

### 2.5 Troubleshooting

- **`Missing required environment variables` on start.** Dev only warns. Fill in the values or ignore the warning while you work on unrelated UI. In CI/production it is fatal.
- **`EBADENGINE` / syntax errors on install.** Your Node version is too old. Upgrade to 20.9 or later.
- **Storybook fails on `@storybook/blocks`.** Storybook 10 moved it: import from `@storybook/addon-docs/blocks`.

---

## 3. Finding something to work on

1. Browse [open issues](https://github.com/ANYTECHS/clips-frontend/issues). Filter by `good first issue` or `help wanted`.
2. **Comment on the issue before you start.** Give a short plan, and wait for a maintainer to assign you. This prevents two people doing the same work.
3. If you're assigned but can't continue, say so on the issue so someone else can pick it up. Issues with no activity for 7 days after assignment may be reassigned.
4. Want to fix something that has no issue yet? Open one first, unless it's a typo or a trivial fix.

### 3.1 Good first issues

These are small, self-contained tasks for learning the codebase. Each needs no secrets or external services. If one isn't on the tracker yet, open an issue with its title and the `good first issue` label, then claim it.

| # | Task | Where | You'll learn |
| --- | --- | --- | --- |
| 1 | Switch story type imports from `@storybook/react` to `@storybook/nextjs-vite` (the framework package) | `components/**/*.stories.tsx`, `stories/*.stories.tsx` | Storybook setup |
| 2 | Delete the Storybook starter samples (`Example/Button`, `Example/Header`, `Example/Page`, `Configure.mdx` and their CSS/assets) | `stories/` | Storybook structure |
| 3 | Add stories for the remaining visual components: `LazyImage`, `VirtualGrid`, `ExploreFeed`, `projects/ClipGrid`, `wallet/ActivityFeed`, `ExportDropdown`, `PrivacySettings`, `SocialRecoveryConfig`, `SyncStatusIndicator` | `components/` | Components, mocking stores and providers |
| 4 | Move the root-level implementation notes (`*_SUMMARY.md`, `ISSUE_*.md`, `*_IMPLEMENTATION.md`) into `docs/`, or remove stale ones, and fix any links to them | repo root | Project history |
| 5 | Remove stray committed files: `install.log`, `Pasted image.png`, `0001-*.patch`, `BRANCH_SUMMARY.txt`, and the nested `clips-frontend/` folder (check nothing imports it first) | repo root | Repo hygiene |
| 6 | Fix the markdownlint warnings (trailing spaces, table spacing) in `docs/ARCHITECTURE.md` | `docs/` | Architecture doc |
| 7 | Add unit tests for `clampPercent()` edge cases (`NaN`, `Infinity`, negatives) | `components/ui/ProgressBar.tsx`, `__tests__/` | Jest and Testing Library |

---

## 4. Contribution guidelines

### 4.1 Code

- **TypeScript strict, no `any`.** See [docs/TYPESCRIPT_STANDARDS.md](docs/TYPESCRIPT_STANDARDS.md).
- **Match the surrounding code:** naming ([docs/naming-conventions.md](docs/naming-conventions.md)), comment density, and Tailwind utility style.
- **Server vs client:** only add `"use client"` where you need interactivity. See [ARCHITECTURE §5](docs/ARCHITECTURE.md#5-client-vs-server-boundaries).
- **API routes:** validate input with zod, use `apiResponse`/`errorResponse`, and use the error codes in [docs/API_ERROR_CODES.md](docs/API_ERROR_CODES.md).
- **New environment variables:** follow [ENVIRONMENT_VARIABLES.md → Adding a new variable](docs/ENVIRONMENT_VARIABLES.md#adding-a-new-variable).

### 4.2 Security (non-negotiable)

- Sanitize every user-controlled string you render with `sanitize()` from `app/lib/sanitize.ts`.
- Never use `dangerouslySetInnerHTML` without DOMPurify sanitization.
- Never commit secrets. `.env.local` is git-ignored. Only `.env.example` is committed, and it holds placeholders only.
- Never put secrets in `NEXT_PUBLIC_*` variables.
- Wallet secrets (secret keys, mnemonics) must never leave the browser and must never be logged.

### 4.3 UI components

- Every new visual component gets a `*.stories.tsx` next to it, with a story per meaningful state. See [STORYBOOK.md](STORYBOOK.md).
- Do **not** add App Router pages to demo components. Use Storybook. Any dev-only route must return 404 when `NODE_ENV === "production"`.
- Components must be keyboard-accessible and pass the Storybook a11y panel. See [docs/ACCESSIBILITY_STANDARDS.md](docs/ACCESSIBILITY_STANDARDS.md).

### 4.4 Tests

- Bug fixes include a test that fails without the fix.
- New logic in `app/lib/`, hooks and stores includes unit tests.
- User-facing flows that change need an E2E test update in `tests/e2e/`.

### 4.5 Docs

Update the docs in the same PR as the code change:

- Architecture changes → `docs/ARCHITECTURE.md` (see its §9).
- Environment variables → `.env.example` and `docs/ENVIRONMENT_VARIABLES.md`.
- Components → stories.

### 4.6 Branches and commits

- Branch from an up-to-date `main`:
  - `feat/<issue>-short-description`
  - `fix/<issue>-short-description`
  - `docs/<short-description>`
  - `hotfix/<short-description>`
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(upload): add chunked resume`, `fix(wallet): …`, `docs: …`, `test: …`, `chore: …`.
- The pre-commit hook runs Prettier and ESLint on staged files (lint-staged). Don't bypass it with `--no-verify`.

---

## 5. Opening a pull request

1. Rebase on the latest `upstream/main`.
2. Run the local checks, which are the same ones CI runs:

   ```bash
   npm run format:check && npm run lint && npm run typecheck && npm run test
   npm run build              # when touching app code
   npm run build-storybook    # when touching components or stories
   ```

3. Add a changeset ([§7](#7-changesets)).
4. Open the PR against `ANYTECHS/clips-frontend:main`. The [PR template](.github/PULL_REQUEST_TEMPLATE.md) loads automatically. Fill in every section.
5. Link the issue with `Closes #123`.
6. For UI changes, add before/after screenshots or a short screen recording.
7. Keep PRs focused: one issue per PR, ideally under ~400 changed lines. Split refactors from behaviour changes.

Draft PRs are welcome for early feedback. Mark the PR **Ready for review** when it is.

---

## 6. Code review process

### 6.1 What happens after you open a PR

```text
open PR ──► CI runs ──► maintainer review ──► changes requested ⟲ ──► approved ──► squash-merge
```

1. **CI must be green.** The checks are package-lock sync, formatting, tests, the changeset check, Playwright and the Storybook build. Reviewers usually wait until it is.
2. **A maintainer reviews within about 3 working days.** If you've had no response after that, leave a polite comment on the PR.
3. **At least one maintainer approval** is required. Changes to auth, wallet/crypto, upload/virus scanning or security headers need a second reviewer.
4. **Maintainers squash-merge.** Your PR title becomes the commit message, so write it in Conventional Commit form.

### 6.2 What reviewers look for

- **Correctness:** does it do what the issue asks, and nothing more? Are edge cases handled?
- **Security:** sanitization, no secrets, authz on API routes, and the `NEXT_PUBLIC_` rules.
- **Tests:** meaningful coverage of the change, not just the happy path.
- **Consistency:** it follows the existing patterns and doesn't add a new library where an existing one would do.
- **Accessibility and performance:** a11y panel clean, no layout shift, bundle budget respected.
- **Docs:** stories, architecture and environment-variable docs updated where relevant.

### 6.3 Responding to review

- Address each comment by pushing a fix or replying with your reasoning. Disagreeing is fine; explain why.
- Push new commits instead of force-pushing during review, so reviewers can see what changed. It's all squashed at merge anyway.
- Resolve a conversation only after you've addressed it. If you're unsure, leave it for the reviewer to resolve.
- Re-request review once you've addressed every comment.

### 6.4 Reviewing others' PRs

Anyone can review, and it's a great way to learn the codebase. Be specific and kind. Prefix non-blocking suggestions with `nit:`, and explain *why* when you ask for a change.

---

## 7. Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and the changelog. **Every PR needs a changeset.** CI checks for one, and the pre-commit hook reminds you.

```bash
npm run changeset
```

Choose the bump type:

- `major` for breaking changes
- `minor` for new features
- `patch` for fixes

Then write a one-line summary. Commit the generated `.changeset/*.md` file.

For docs-only changes or internal refactors with no user impact:

```bash
npm run changeset -- --empty
```

Releases: maintainers run `npx changeset version` to consume the changesets, bump `package.json` and update `CHANGELOG.md`.

---

## 8. Communication

| Need | Where |
| --- | --- |
| Report a bug | [New issue → Bug report](https://github.com/ANYTECHS/clips-frontend/issues/new/choose) |
| Propose a feature | [New issue → Feature request](https://github.com/ANYTECHS/clips-frontend/issues/new/choose) |
| Claim or discuss a task | Comment on the issue |
| Ask a question or get unblocked | Open an issue titled `help wanted: <topic>`, or ask on the relevant issue or PR |
| Code feedback | PR review comments |
| Get a maintainer's attention | Mention `@ANYTECHS` maintainers in a comment |
| **Security vulnerability** | **Don't open a public issue.** Use GitHub's private reporting: [Security → Report a vulnerability](https://github.com/ANYTECHS/clips-frontend/security/advisories/new). |

Keep technical discussion in public issues and PRs so others can learn from it and find it later. Be respectful and assume good intent. Harassment or discriminatory language is not tolerated in any project space.

---

## 9. Recipes

### 9.1 Adding a component

1. Create `components/<area>/MyThing.tsx`, typing the props with an exported `interface`.
2. Create `components/<area>/MyThing.stories.tsx` with `tags: ['autodocs']`, a JSDoc usage example, and one story per state.
3. Add tests in `__tests__/` if it has logic.

### 9.2 Adding an API route

1. Create `app/api/<resource>/route.ts`.
2. Authenticate with `auth()`, validate the body with zod, and apply rate limiting.
3. Return responses via `apiResponse` / `errorResponse`.
4. Add tests and, if you changed the contract, update [docs/API_CONTRACT_TESTING.md](docs/API_CONTRACT_TESTING.md).

### 9.3 Adding a new locale (i18n)

The project uses a custom i18n system in `app/lib/i18n/`.

1. **Define the locale type:** add the code (e.g. `de`) to the `Locale` type in `app/lib/i18n/types.ts`.
2. **Create the translation file:** add `app/lib/i18n/locales/de.json`, using `en.json` as a template. Translate every key.
3. **Register it:** import the JSON in `app/lib/i18n/translations.ts` and add it to `translations`.
4. **Update the provider:** add the locale to `AVAILABLE_LOCALES` in `app/lib/i18n/I18nProvider.tsx`, and to the `useEffect` that restores the locale from `localStorage`.
5. **Add tests:** extend `__tests__/lib/i18n.test.ts` to check the locale loads and falls back to English for missing keys.

---

Thanks again. Contributions make ClipCash better for everyone!
