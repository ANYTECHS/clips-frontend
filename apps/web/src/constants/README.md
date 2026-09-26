# Constants Organization Guide

This directory centralizes constants that were previously scattered across
component files. The goal is a single, predictable place to find and update
shared values.

## Structure

Constants are grouped by domain, one file per domain, and re-exported from a
central barrel (`index.ts`) so consumers can import from a single location.

```
apps/web/src/constants/
  index.ts        # central barrel: re-exports every domain
  ui.ts           # layout, breakpoints, animation, display limits
  api.ts          # endpoints, timeouts, retry policy
  app.ts          # app-wide metadata and feature flags
```

## Conventions

- **One domain per file.** Keep related values together; do not create a
  catch-all `misc.ts`.
- **Named exports only.** No default exports, so the barrel stays explicit.
- **`UPPER_SNAKE_CASE`** for primitive constants; `PascalCase` for constant
  objects and enums.
- **`as const`** on object/array constants to preserve literal types.
- **No side effects.** Constants files must not import components or run code.
- **No secrets.** Never place tokens, keys, or credentials here; use env vars.

## Usage

Import from the central barrel rather than reaching into a domain file:

```ts
import { MAX_ITEMS_PER_PAGE, API_TIMEOUT_MS } from '@/constants';
```

## Adding a constant

1. Decide the domain. If none fits, create a new domain file and add it to the
   barrel.
2. Add the value with a short doc comment explaining its purpose and units.
3. Replace the inline definition at the call site with an import from
   `@/constants`.
4. Remove the now-unused inline constant.

## Documenting constants

Each exported constant should have a brief comment describing what it controls
and any constraints (units, valid ranges, related values).
