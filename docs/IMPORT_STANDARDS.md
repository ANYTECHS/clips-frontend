# Import standards

Issue #944. Enforced by `eslint.config.mjs`; `npm run lint:fix` applies all of
it automatically.

## The rules

**1. Use the `@/` alias for anything two or more directories away.**

```ts
// No
import Navbar from "../../components/clips/ClipsNavbar";
import { auth } from "../../../lib/auth";

// Yes
import ClipsNavbar from "@/components/clips/ClipsNavbar";
import { auth } from "@/app/lib/auth";
```

`@/*` maps to the repo root in `tsconfig.json`. Deep relative paths are
unreadable, break the moment a file moves, and make two files importing the
same module look like they import different ones — which defeats grep and
confuses every refactoring tool.

**2. Keep `./` and `../` inside a feature folder.**

```ts
// Yes — colocated, and the relative path says so
import { clipsStore } from "./clipsStore";
import type { ApiResponse } from "../types";
```

A single level up is genuinely clearer than an absolute path: it tells the
reader the module lives alongside this one. Only paths climbing two or more
levels are flagged.

**3. Order is automatic.**

`simple-import-sort` groups and sorts imports. Don't hand-order them; run
`--fix`. The groups it produces, in order:

1. Side-effect imports (`import "./globals.css"`)
2. Node builtins and external packages (`react`, `next/server`, `zod`)
3. Internal aliases (`@/app/...`, `@/components/...`)
4. Relative imports (`../`, then `./`)
5. Style imports

**4. Type-only imports are marked.**

```ts
import type { Clip } from "./clipsStore";
import { clipsStore } from "./clipsStore";
```

`import type` is erased at compile time. Marking it keeps type-only
dependencies out of the runtime bundle and out of circular-import chains.

## Why the rules are warnings

Both the ordering rules and the deep-relative-path ban are `warn`, not
`error`.

The codebase predates the standard by hundreds of files. Setting these to
`error` would make `npm run lint` fail on every PR regardless of what it
touched — a signal nobody can act on, which gets muted and then ignored.

As warnings, they:

- do not block CI on pre-existing violations
- are fixed automatically by `lint-staged` on every commit, so each file is
  cleaned as it is edited
- can be raised to `error` once the backlog is gone, without another round of
  discussion

To see what is left:

```bash
npm run lint 2>&1 | grep -c "simple-import-sort"
```

To fix everything at once — worth doing as its own commit, since it touches a
lot of files and would otherwise bury the real change in a PR:

```bash
npm run lint:fix
```

## Adding a new alias

Add it to `compilerOptions.paths` in `tsconfig.json`. Next.js reads that
directly, so nothing else needs configuring. Keep the set small — an alias per
top-level folder is a directory listing, not an abstraction.
