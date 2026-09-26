# Formatting Standards

This repository uses Prettier as the canonical formatter for JavaScript, TypeScript, JSON, Markdown, and similar source files.

## Required configuration

- `semi: true`
- `singleQuote: false`
- `trailingComma: "es5"`
- `printWidth: 100`
- `tabWidth: 2`
- `useTabs: false`
- `endOfLine: "lf"`

The repo-level configuration is in `.prettierrc.json` and the lockfile is intentionally ignored for formatting.

## Local workflow

```bash
npm run format
npm run format:check
```

## CI enforcement

`npm run format:check` is part of the GitHub Actions workflow in `.github/workflows/ci.yml`.

## Pre-commit enforcement

The Husky pre-commit hook runs `lint-staged`, which applies Prettier to staged files before the commit is finalized.
