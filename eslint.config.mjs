// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import path from "node:path";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── File naming (Issue #1120) ────────────────────────────────────────────
//
// File and directory names are kebab-case. Each dot-separated part of a name
// is checked on its own, so `use-balance.test.ts` and `clip-ranking.worker.ts`
// pass. Next.js routing segments (`[id]`, `(dashboard)`, `@modal`, `_private`),
// dunder folders (`__tests__`) and dotfolders are exempt. See docs/naming-conventions.md.
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isExemptSegment(segment) {
  return /^[[(@_.]/.test(segment);
}

function toKebabCase(name) {
  return name
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function invalidParts(segment) {
  return segment.split(".").filter((part) => part && !KEBAB_CASE.test(part));
}

const fileNamingPlugin = {
  rules: {
    "kebab-case": {
      meta: {
        type: "suggestion",
        docs: { description: "Require kebab-case file and directory names" },
        schema: [],
        messages: {
          file: "File name '{{name}}' must be kebab-case — rename to '{{suggestion}}'. See docs/naming-conventions.md.",
          directory:
            "Directory '{{name}}' must be kebab-case — rename to '{{suggestion}}'. See docs/naming-conventions.md.",
        },
      },
      create(context) {
        const relativePath = path.relative(context.cwd, context.filename);
        if (relativePath.startsWith("..")) return {};
        const segments = relativePath.split(path.sep);
        const fileName = segments.pop();
        const problems = [];

        for (const dir of segments) {
          if (!isExemptSegment(dir) && invalidParts(dir).length > 0) {
            problems.push({ messageId: "directory", data: { name: dir, suggestion: toKebabCase(dir) } });
          }
        }
        const [stem, ...rest] = fileName.split(".");
        if (!isExemptSegment(fileName) && invalidParts(stem).length > 0) {
          const suggestion = [toKebabCase(stem), ...rest].join(".");
          problems.push({ messageId: "file", data: { name: fileName, suggestion } });
        }

        if (problems.length === 0) return {};
        return {
          Program(node) {
            for (const problem of problems) context.report({ node, loc: { line: 1, column: 0 }, ...problem });
          },
        };
      },
    },
  },
};

// ── Async/await standard (Issue #1117) ───────────────────────────────────
//
// Promise chains are banned in favour of async/await + try/catch/finally.
// `.catch()` stays allowed for a fallback value (`await res.json().catch(() => ({}))`)
// and for fire-and-forget handlers (`void p.catch(log)`). `import().then(m => m.X)`
// is exempt because `next/dynamic` needs a named export mapped to a default.
// See docs/ASYNC_PATTERNS.md.
//
// `no-restricted-syntax` options don't merge across config blocks — the last
// matching block wins — so any block that sets the rule must spread these in.
const asyncAwaitSyntaxRules = [
  {
    selector: "CallExpression[callee.property.name='then']:not([callee.object.type='ImportExpression'])",
    message: "Use async/await instead of .then() chains. See docs/ASYNC_PATTERNS.md.",
  },
  {
    selector: "CallExpression[callee.property.name='finally']",
    message: "Use try/finally inside an async function instead of .finally(). See docs/ASYNC_PATTERNS.md.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // next/jest configs must use CommonJS `require`
    "jest.config.js",
    "jest.integration.config.js",
    "jest.setup.js",
    // Agent tooling scratch space. Untracked, not source, and was contributing
    // 702 of the 4866 findings — enough noise to bury anything real.
    ".kilo/**",
    // A separate React Native project with its own package.json and its own
    // `npm run lint`. Linting it with the Next.js config reports problems
    // against the wrong framework's rules.
    "mobile-app/**",
  ]),
  ...storybook.configs["flat/recommended"],
  {
    // Security-sensitive rules
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-eval": "error",
      complexity: ["warn", 10],
      "max-depth": ["warn", 4],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Exclude test files from no-console
    files: [
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
      "**/__tests__/**",
      "**/__mocks__/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // ── Production source: `console` is an error, not a warning (#1113) ───
    //
    // A `console.log` in shipped code bypasses `app/lib/logger.ts`, so it
    // never reaches Sentry and is invisible in production, where nobody has
    // devtools open. The global rule above only warns, which is not enough to
    // stop it coming back — it was read as advisory, and 11 of them survived.
    //
    // No exceptions within production source. Earlier this allowed
    // `console.warn`/`console.error` on the theory that a warning which reaches
    // nobody is worse than a swallowed one — but the migration showed the
    // opposite: every such call site had a `logger.warn`/`logger.error` that
    // *also* forwards to Sentry, so the raw console call was never the only
    // record, just a duplicate of it. Allowing them kept a bypass open around
    // the logger with nothing to gain, so they are errors too.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },
  {
    // Two deliberate exceptions to the rule above.
    //
    // `app/lib/logger.ts` is the sink every other file logs *through*; its
    // `consoleFallback` is the last resort when no drain is configured, so
    // console use there is the implementation rather than a leak, and
    // silencing it is the only way the file can do its job.
    //
    // Stories are documentation fixtures rendered in Storybook, never
    // shipped — a `console.log` demonstrating a callback is the point of the
    // example.
    files: ["app/lib/logger.ts", "**/*.stories.ts", "**/*.stories.tsx"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // ── Dead code detection (#1108) ───────────────────────────────────────
    //
    // Flags commented-out source code so it gets deleted instead of rebuilt
    // around. Hand-rolled in eslint-rules/ — the package this was meant to
    // come from was unpublished from npm and can never install. See that
    // file for why the heuristic requires both a code-shaped start *and* end
    // before reporting.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "local/no-commented-out-code": "error",
      // ── User-facing error message standard (#1109) ──────────────────────
      //
      // Enforces that inline strings passed to `setError`-style setters end
      // with a period, leak no system vocabulary, and never interpolate a
      // caught error's message. Messages themselves live in
      // app/lib/errorMessages.ts; see docs/ERROR_HANDLING.md for the standard.
      "local/error-message-style": "error",
    },
  },
  {
    // ── Magic numbers (#1106) ─────────────────────────────────────────────
    //
    // Tests are excluded deliberately. A literal in a test is *usually* fixture
    // data — `formatAmount.test.ts` alone accounted for 47 of these, asserting
    // on values like `1234.567`. Naming them would make the tests harder to
    // read, not easier, because the literal is the point: the assertion is
    // "this number formats to that", and `EXPECTED_FORMATTED_AMOUNT` would
    // hide the value being asserted.
    //
    // The rule earns its keep in `app/**` source, where a bare `300` is a
    // decision someone made and a reader cannot recover.
    files: ["app/**/*.ts", "app/**/*.tsx"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"],
    rules: {
      "no-magic-numbers": [
        "warn",
        {
          ignore: [
            // Structural: indices, counts of one, and the unit multipliers
            // that are self-describing in context.
            0, 1, 2, 3, 5, 8, -1, 100, 1000, 1024, 60, 24, 7, 12,
            // HTTP status codes. `res.status === 429` reads faster than
            // `res.status === HTTP_TOO_MANY_REQUESTS`, and these are a
            // published vocabulary rather than a local decision.
            200, 201, 204, 301, 302, 400, 401, 403, 404, 429, 500, 502, 503,
          ],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-syntax": ["error", ...asyncAwaitSyntaxRules],
    },
  },
  {
    // Prisma migration folders are timestamped by the Prisma CLI.
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: ["prisma/migrations/**"],
    plugins: { "file-naming": fileNamingPlugin },
    rules: {
      "file-naming/kebab-case": "error",
    },
  },
  {
    files: ["app/hooks/**/*.ts", "app/hooks/**/*.tsx", "app/lib/**/*.ts", "app/lib/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...asyncAwaitSyntaxRules,
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration[id.name=/^mock/]",
          message:
            "Functions starting with 'mock' must not be exported from production source files. Move them to __tests__/mocks/ or __mocks__/.",
        },
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^mock/]",
          message:
            "Variables/constants starting with 'mock' must not be exported from production source files. Move them to __tests__/mocks/ or __mocks__/.",
        },
      ],
    },
  },
  {
    files: ["app/store/**/*.ts", "app/store/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mockApi*", "**/mockApi/**", "**/mock-api*", "**/mock-api/**"],
              message:
                "Store files must not import from mockApi directly. Use the ./api barrel export instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Build-time guard: no API route file may import from mockApi (in any location).
    // This prevents mock data from accidentally shipping to production.
    files: ["app/api/**/*.ts", "app/api/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mockApi*", "**/mockApi/**", "**/mock-api*", "**/mock-api/**", "**/__mocks__/**"],
              message:
                "API routes must not import from mockApi or __mocks__. Replace with a real database query.",
            },
          ],
        },
      ],
    },
  },
  {
    // Build-time guard: no app page or component may import from mockApi.
    // This prevents mock data from accidentally shipping to production.
    files: ["app/**/*.ts", "app/**/*.tsx", "components/**/*.ts", "components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mockApi*", "**/mockApi/**", "**/mock-api*", "**/mock-api/**"],
              message:
                "App pages and components must not import from mockApi. Replace with real API calls.",
            },
          ],
        },
      ],
    },
  },
  {
    // Node scripts use CommonJS.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  {
    // Global stylistic and cleanup rules
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // Remove unused imports via plugin
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
      // ── Import standards (Issue #944) ──────────────────────────────────
      //
      // Ordering is `warn`, not `error`. The codebase predates the standard by
      // hundreds of files, so erroring would make `npm run lint` fail on every
      // PR regardless of what it touched — a signal nobody can act on, which
      // gets muted and then ignored. `--fix` resolves every one of these
      // automatically, so the backlog clears as files are edited, and
      // lint-staged fixes each file on the way past.
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",

      // Enforce TypeScript naming conventions
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "import", format: ["camelCase", "PascalCase"] },
        { selector: "objectLiteralProperty", format: null },
        { selector: "variableLike", format: ["camelCase", "UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "function", format: ["camelCase", "PascalCase"] },
      ],
    },
  },
  {
    // ── Path aliases over deep relative paths (Issue #944) ────────────────
    //
    // `../../components/x` is unreadable, breaks the moment a file moves, and
    // makes two files importing the same module look like they import
    // different ones. `@/*` is already configured in tsconfig.json — this
    // makes it the rule rather than a convention half the codebase follows.
    //
    // Only paths climbing two or more levels are banned. A single `./` or
    // `../` inside a feature folder is genuinely clearer than an absolute
    // path, and rewriting those would make colocated files harder to read,
    // not easier.
    //
    // `warn` for the same reason as the ordering rules above.
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "stories/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["../../*"],
              message:
                "Use the '@/' path alias instead of climbing two or more directories. See docs/IMPORT_STANDARDS.md.",
            },
          ],
        },
      ],
    },
  },
  {
    // ── Export conventions (Issue #1126) ─────────────────────────────────
    //
    // Named exports are the standard: they are greppable, rename-safe, and
    // keep a module's public surface explicit. Default exports hide the
    // symbol name at the import site and make refactors harder.
    //
    // `warn` for the same reason as the import rules above — the codebase
    // still has default exports to migrate, and erroring would fail every
    // PR regardless of what it touched. `--fix` cannot rewrite these
    // automatically, so the backlog clears as files are edited.
    //
    // Config files (eslint.config.mjs, next.config.*, etc.) are exempt:
    // their tooling requires a default export.
    files: ["**/*.{ts,tsx,js,jsx}"],
    ignores: [
      "**/*.config.{ts,tsx,js,jsx,mjs,cjs}",
      "**/*.stories.{ts,tsx,js,jsx}",
      "**/*.test.{ts,tsx,js,jsx}",
      "**/*.spec.{ts,tsx,js,jsx}",
      "**/__tests__/**",
      "**/__mocks__/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Prefer named exports over default exports. See docs/EXPORT_CONVENTIONS.md.",
        },
      ],
    },
  },
]);

export default eslintConfig;
