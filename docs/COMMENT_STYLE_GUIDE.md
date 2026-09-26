# Comment Style Guide

This guide defines the comment conventions used across the codebase. Its goal is
consistency: comments should be predictable in format, useful in content, and
enforced automatically where possible.

## Principles

- Comments explain **why**, not **what**. Prefer clear code over narrating code.
- Keep comments accurate. A stale comment is worse than no comment.
- Remove obsolete comments instead of leaving them disabled or commented-out.
- Write in complete sentences, ending with a period.
- Use American English and a neutral, professional tone.

## Documentation comments (JSDoc / TSDoc)

Use documentation comments for every exported symbol: functions, classes, types,
interfaces, constants, and React components.

- Use `/** ... */` block comments placed immediately above the declaration.
- Start with a one-line summary in the imperative or descriptive mood.
- Document parameters with `@param`, return values with `@returns`, thrown
errors with `@throws`, and deprecations with `@deprecated`.
- Omit `@param`/`@returns` when the signature is fully self-explanatory and the
summary already conveys the behavior.

```ts
/**
 * Formats a duration in milliseconds as a human-readable string.
 *
 * @param ms - Duration in milliseconds.
 * @returns A string such as `"1h 30m"`.
 */
export function formatDuration(ms: number): string {
  // ...
}
```

## Inline comments

- Use `//` for single-line comments and `/* ... */` only for multi-line blocks.
- Place the comment on the line above the code it describes, not at the end of a
line, unless the note is genuinely short and local.
- Leave one space after the comment marker: `// note`, not `//note`.
- Do not use inline comments to restate the code.

```ts
// Retry once because the upstream API is eventually consistent.
await fetchWithRetry(url, { retries: 1 });
```

## TODO / FIXME / NOTE conventions

Use a consistent, greppable format with an owner and, where possible, a link to
the tracking issue:

- `// TODO(<owner>): <description>` — planned work.
- `// FIXME(<owner>): <description>` — known defect that needs fixing.
- `// NOTE: <description>` — non-obvious context worth preserving.

```ts
// TODO(@octocat): remove this shim once the v2 API ships (#1234).
// FIXME(@octocat): handle the empty-response case (#1235).
```

## Formatting rules

- Keep comment lines within the project's line-length limit (see the linter
configuration).
- Do not leave commented-out code in the repository; delete it and rely on
version control.
- Do not add license headers or attribution tags to individual files.
- Keep a single blank line between a documentation comment and the preceding
code block.

## Enforcement

Comment style is enforced automatically by ESLint via the `eslint-plugin-jsdoc`
rules configured in `.eslintrc.js` (see the `jsdoc/*` rules). Run the linter
before opening a pull request:

```sh
npm run lint
```

## Reviewing comments in pull requests

Reviewers should check that:

- New and changed comments follow this guide.
- Documentation comments exist for new exported symbols.
- Obsolete or commented-out code is removed.
- `TODO`/`FIXME` entries include an owner and, where applicable, an issue link.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the broader contribution workflow.
