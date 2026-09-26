# Critical: corrupted source files and quality gates that cannot fail

**Status:** unfixed. Written up during #1108 / #1109 / #1113 / #1106, which intentionally
did not touch this.
**Severity:** high — one dashboard route is broken in production, and CI cannot detect it.

## Summary

Two independent problems, either of which alone would be worth a fix:

1. **Eleven source files are syntactically invalid.** They are imported by live
   routes. `npm run typecheck` exits 2 with 138 errors.
2. **CI has no gate that can fail on any of it.** Tests do not run, the build is
   allowed to fail, and there is no typecheck or lint step.

They compound: the corruption is undetectable _because_ the gates are absent, so
the absence is the root cause and the corruption is the symptom.

---

## 1. Corrupted source files

Every one of these is imported by a page under `app/(dashboard)/`.

| File                                                  | Break                                                                                                              | Typecheck errors |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `components/vault/VaultSidebar.tsx`                   | **Not code.** 8 lines of pasted GitHub bounty text (`# Bounty Contribution`, `**Reward: $453…`). Zero JSX.         | 25               |
| `components/wallet/ActivityFeed.tsx:318`              | Unterminated `<div` — the next element begins mid-attribute                                                        | 11               |
| `app/api/clips/route.ts:86`                           | Parse error, `';' expected`                                                                                        | 8                |
| `components/wallet/TransactionHistoryViewer.tsx:347`  | `"…the "All" tab…"` — unescaped quotes inside a double-quoted string                                               | 3                |
| `components/dashboard/StatCard.tsx:43`                | Orphaned `}, [trend, hideTrendIcon]);` — a `useMemo` was inlined into the function body and its closer left behind | 2                |
| `app/api/schemas/clips.schema.ts:16`                  | Dangling `});` from a `.transform()` chain                                                                         | 2                |
| `app/api/dashboard/route.ts:100`                      | Parse error, `')' expected`                                                                                        | —                |
| `app/api/earnings/route.ts:117`                       | Parse error, `')' expected`                                                                                        | —                |
| `app/lib/stellarTransaction.ts:384`                   | Parse error, `'}' expected`                                                                                        | —                |
| `__tests__/earnings/earnings-filters-mock.test.ts:81` | Parse error, `'>' expected`                                                                                        | —                |
| `__tests__/hooks/useWindowVirtualizer.test.ts:45`     | Parse error, `'>' expected`                                                                                        | —                |

The first six were inspected by hand and the break is confirmed by reading the
line. The last five are reported by ESLint's parser but were not individually
opened — treat the specific column as a starting point, not a diagnosis.

### `VaultSidebar.tsx` is worse than the others

It is not a corrupted component; the component has never existed. Git history
shows it added in a single commit — `e254661 fix: address #233 - bounty
contribution ($45320.8)` — containing only the task description. Meanwhile
`app/(dashboard)/vault/page.tsx:5` imports it and passes `activeFilter` /
`onFilterChange`. So `/vault` cannot build, and there is no prior revision to
restore from. It needs writing from the props contract at the call site.

Note the commit subject: a bounty "fix" for a large sum that replaced a
component with its own description. Worth asking how it passed review, because
the answer is the same as §2.

### Reproduce

```bash
npx eslint . -f json -o /tmp/lint.json   # look for ruleId: null (parse errors)
npm run typecheck                         # exit 2, 138 errors
```

---

## 2. CI cannot fail

`.github/workflows/ci.yml` gates that actually assert something: **formatting,
complexity, migrations, and a changeset check.** That is the whole list.

| Step                                  | Reality                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Verify package-lock.json is in sync` | **was failing.** `npm ci --dry-run` exited 1 — `@typescript-eslint/eslint-plugin@6` requires `eslint ^7 \|\| ^8`, repo has eslint 9. Fixed as part of this work. |
| `Unit tests`                          | `run: echo "E2E PR — unit coverage validated on sibling PRs."` — **the test suite does not execute.**                                                            |
| `Production build`                    | `continue-on-error: true` — **a broken build is a green build.**                                                                                                 |
| Lint                                  | **no step.** Also unrunnable: `eslint.config.mjs` imported two plugins that were in neither `node_modules` nor `package-lock.json`. Fixed as part of this work.  |
| Typecheck                             | **no step.** `npm run typecheck` exists and fails with 138 errors.                                                                                               |

With tests stubbed, the build allowed to fail, and no typecheck, a Markdown file
can be merged into the component tree — which is exactly what happened.

### Reproduce

```bash
grep -E '^\s+- name:' .github/workflows/ci.yml  # the inventory above
```

---

## Proposed fix, in order

1. **Repair the eleven files.** `VaultSidebar` needs writing from scratch;
   the rest are small local repairs. Target: `npm run typecheck` exits 0.
2. **Add a typecheck step.** It is the gate that would have caught all eleven.
   Non-negotiable, and free once §1 is done.
3. **Un-stub the tests.** Replace the `echo` with `npm test`. If the suite is
   too slow or too red to gate on today, say so explicitly and gate on a
   subset — but the current string is a placeholder that reads as a passing
   test, which is worse than an absent step.
4. **Stop swallowing the build.** Remove `continue-on-error: true` from the
   build step once §1 is done. The bundle-budget step below it already guards
   against a missing `.next`, so a failed build currently reports as "no output
   — skipping", which is the same false green in a different coat.
5. **Consider a `tsc`/lint ratchet**, mirroring `scripts/check-lint.js`, so
   these cannot silently return.

## Repo hygiene, same PR or a follow-up

These are committed and should not be:

- `install.log` — a Windows npm error log from another contributor's machine
  (`C:\Users\rahma\…\node_modules\eslint\lib`, `ENOTEMPTY: directory not empty`),
  dated 2026-08-28
- `Pasted image.png`
- `0001-chore-template-target-apps-web-and-add-acceptance-cr.patch`
- `issue.md`, `issues.md`, `pr.md`, `BRANCH_SUMMARY.txt`, `TODO.md`
- `test-auth-security.js` — a root-level script with 24 `console.*` calls
- `clips-frontend/components/platforms/help_banner.tsx` — a stray file in a
  nested directory named after the repo itself

`.kilo/` was untracked but unignored and held a **full worktree** — a duplicate
of every file, enough to trip jest's haste-map collision check on every run. Now
in `.gitignore` and ESLint's `globalIgnores`.

Separately, `eslint --fix` would resolve **1,334 findings across 1,135 files**,
almost all `simple-import-sort/imports` (1,105). Too large to review as one
diff; best done opportunistically per-directory rather than swept.
