# Import Standards

Issue: #1347 — Eliminate barrel-file import cycles

Circular imports break tree-shaking, make module initialisation order
unpredictable (a symbol can be `undefined` at import time), and cause
`next build` warnings. These rules keep the dependency graph a DAG.

## Layers

Modules may import only from their own layer or from a layer **below** it:

```text
app/            routes, layouts, loading/error boundaries, route handlers   (top)
  └─ components/  React UI
       └─ lib/      framework-agnostic logic: API client, queries, stores, hooks, i18n   (bottom)
```

| From           | May import                                   | Must not import          |
| -------------- | -------------------------------------------- | ------------------------ |
| `app/**`       | `components/**`, `lib/**`, `app/**`          | —                        |
| `components/**`| `components/**`, `lib/**`                    | `app/**`                 |
| `lib/**`       | `lib/**`, npm packages                       | `components/**`, `app/**`|

Shared, framework-agnostic helpers that live under `app/` (for example
`app/api/pagination.ts`) may be imported by other `app/**` modules only. If
`components/` or `lib/` ever needs one, move it down into `lib/`.

Inside `components/`, imports between folders are allowed as long as they only
go one way:

- Feature folders (`dashboard/`, `projects/`, …) import primitives from
  `components/shared/` (`Button`, `Skeleton`, …). Primitives never import
  feature components.
- Layout shells (`components/shared/DashboardLayout.tsx`) compose feature
  chrome (`dashboard/DashboardSidebar`, `dashboard/DashboardHeader`,
  `dashboard/MobileBottomNav`). Those chrome components must **never** import
  the shell back. Pages and content components render inside the shell.
- Cross-feature reuse (for example `auth/StepUpModal` used by
  `agent-marketplace/` and `ai-projects/`) is fine. If two features end up
  needing each other, move the shared piece into `components/shared/`.

## Barrel files (`index.ts`)

- **Don't add new barrel files** under `app/`, `components/` or `lib/`. Import
  the module directly: `import Button from "@/components/shared/Button"`, not
  `import { Button } from "@/components/shared"`.
- A barrel may exist only as the public entry point of a self-contained module
  (today: `lib/i18n/index.ts`). It must only re-export its own folder's
  files, and those files must never import the barrel back (`from "."` or
  `from "@/lib/i18n"` inside `lib/i18n/`). Use relative paths to siblings
  instead.
- Never re-export across layers (for example a `components/` barrel that
  re-exports from `lib/`).

## Breaking a cycle

When two modules need each other:

1. **Extract the shared part** (types, constants, pure helpers) into a third
   module that both import. Types are usually the culprit; put them in a
   `types.ts` beside the code that owns them.
2. **Use `import type`** for type-only dependencies. They are erased at
   compile time and never create a runtime cycle.
3. **Invert the dependency**: pass a callback or value in as a prop or
   argument instead of importing it.

## Enforcement

- ESLint (`eslint.config.mjs`) runs `import/no-cycle` across the project and
  `no-restricted-imports` to enforce the layer table above.
- To audit manually:

  ```bash
  npx madge --circular --extensions ts,tsx --ts-config tsconfig.json app components lib
  ```

  The expected output is `No circular dependency found!`.
