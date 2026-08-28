# TypeScript Standards

The codebase intentionally keeps TypeScript in strict mode to prevent unsafe runtime assumptions and reduce regressions during feature work.

## Active rules

The root `tsconfig.json` enables the following, with additional safety gates enabled beyond the default strict profile:

- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- `strictBindCallApply: true`
- `strictPropertyInitialization: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `forceConsistentCasingInFileNames: true`

## Validation

```bash
npm run typecheck
```

## Contributor guidance

- Prefer explicit return types for exported functions.
- Avoid `any` unless it is contained within a documented, temporary adapter boundary.
- Treat `null` and `undefined` as separate states.
- Use discriminated unions for shared state or API payloads.
- Add tests that cover the stricter parsing and validation paths.
