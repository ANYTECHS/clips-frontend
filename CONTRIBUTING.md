# Contributing to ClipCash

Thanks for contributing! This guide walks you through your first change, from
local setup through opening a pull request.

## First contribution: step by step

### 1. Find a small issue

Start with the
[good first issues](https://github.com/ellaehi20-tech/clips-frontend/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
You can also browse [open issues](https://github.com/ellaehi20-tech/clips-frontend/issues)
and look for a clearly scoped bug or documentation improvement.

Before starting, add a short comment that you would like to work on the issue.
If nobody has claimed it, wait for a maintainer to confirm the approach if the
change may affect public behavior or application architecture.

### 2. Fork and clone the repository

Fork `ellaehi20-tech/clips-frontend` on GitHub, then clone your fork:

```bash
git clone https://github.com/<your-github-username>/clips-frontend.git
cd clips-frontend
git remote add upstream https://github.com/ellaehi20-tech/clips-frontend.git
git fetch upstream
```

Node.js 20 or newer and npm are required.

### 3. Set up the app

Install the dependencies:

```bash
npm install
```

Create `.env.local` in the repository root. The following values match the
development setup described in the README:

```dotenv
# Server-only — never send the real backend URL to the browser
API_URL=https://clipcash-api.onrender.com

# Client-side — points to the Next.js proxy route
NEXT_PUBLIC_API_URL=/api/proxy

# Use testnet unless the task specifically requires mainnet
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

Do not commit `.env.local` or API credentials.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend is hosted on
Render and may take roughly 30 seconds to wake from an idle state.

### 4. Create a focused branch

Update your local main branch, then create a branch named for the issue:

```bash
git switch main
git pull --ff-only upstream main
git switch -c fix/short-description
```

Keep the change focused on one issue. Add or update tests when the project
provides a test runner for the affected behavior.

### 5. Make and review the change

Use the existing TypeScript, React, Tailwind, and App Router patterns in nearby
files. Before finishing:

- Reproduce the issue or confirm the missing behavior.
- Make the smallest complete change that fixes it.
- Manually check the affected page at desktop and mobile widths.
- Verify that API values stay server-side when possible.
- Do not commit generated `.next`, build output, credentials, or unrelated edits.

### 6. Run the checks

Run the repository checks from the project root:

```bash
npm run lint
npm run build
```

Both commands should finish successfully before opening a PR. Fix all new
lint, type, and build errors, then inspect `git diff` to make sure no unrelated
files changed.

This repository does not currently define a unit or end-to-end test script.
There is therefore no `npm test` or `npm run test:e2e` command to run yet.
If an issue introduces test tooling, follow the test command documented in
that issue or in `package.json`.

### 7. Commit and push

Write a concise commit message that describes the result:

```bash
git add <changed-files>
git commit -m "Fix: describe the focused change"
git push -u origin fix/short-description
```

### 8. Open a pull request

Open a pull request from `fix/short-description` to
`ellaehi20-tech/clips-frontend:main`.

In the PR description:

- Link the issue, for example `Fixes #123`.
- Summarily explain what changed and why.
- Add screenshots or short recordings for UI changes.
- List the commands you ran and their results.
- Call out any known limitation, follow-up work, or manual verification needed.

Keep the PR open for maintainer review. Respond to feedback by adding commits
to the same branch and pushing again; do not force-push while a review is in
progress.

## Pull request checklist

- [ ] The change is focused on the issue.
- [ ] The branch is based on the latest upstream `main`.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] The relevant page or behavior was checked manually.
- [ ] The PR description includes the issue link and screenshots for UI work.
- [ ] No secrets or local environment files are included.

## Development conventions

- Use 2-space indentation and the existing TypeScript style.
- Reuse existing components and helpers when a suitable one already exists.
- Keep API logic behind `lib/apiClient.ts` or the proxy route unless the task
  requires otherwise.
- Never expose `API_URL` or backend credentials through `NEXT_PUBLIC_*`.
- Update related documentation when behavior or setup changes.
