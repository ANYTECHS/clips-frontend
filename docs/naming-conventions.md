# Naming Conventions

This project follows a small set of naming rules enforced by ESLint and code review.

- Files: kebab-case for file names (e.g. `my-component.tsx`).
- Components & Types: PascalCase for React components and type declarations.
- Variables, functions, methods: camelCase.
- Constants: UPPER_CASE for exported/constants with stable values.
- Hooks: start with `use` (e.g. `useAuth`) and be camelCase.

These rules are enforced via `@typescript-eslint/naming-convention` in the ESLint config.

When in doubt, follow existing file patterns in `app/` and `components/`.
