// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import noCommentedOutCode from "./eslint-rules/no-commented-out-code.js";
import errorMessageStyle from "./eslint-rules/error-message-style.js";

// Rules maintained in this repo. See eslint-rules/ for the rationale on each.
const localPlugin = {
  rules: {
    "no-commented-out-code": noCommentedOutCode,
    "error-message-style": errorMessageStyle,
  },
};

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
    files: ["app/hooks/**/*.ts", "app/hooks/**/*.tsx", "app/lib/**/*.ts", "app/lib/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
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
              group: ["**/mockApi*", "**/mockApi/**"],
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
              group: ["**/mockApi*", "**/mockApi/**", "**/__mocks__/**"],
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
              group: ["**/mockApi*", "**/mockApi/**"],
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
  // ── Identifiers fixed by an external API, not chosen by us ──────────────
  //
  // These sit last on purpose. Flat config resolves conflicts by taking the
  // *last* matching block, so an exemption placed earlier is silently
  // overridden by the broad `**/*.{ts,tsx,js,jsx}` block above — which is
  // exactly what happened the first time these were written.

  {
    // `const { ESLint } = require("eslint")` destructures the library's own
    // class name. Renaming the binding would work but reads worse than the
    // thing it aliases.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },
  {
    // A local ESLint rule is a plain object handed to the ESLint API, so two
    // classes of identifier in it are fixed by that API rather than chosen:
    // the visitor keys (`Program`, `CallExpression`, …) must match AST node
    // type names exactly, and the exported rule shape (`meta`, `create`) is
    // likewise a contract. Renaming either simply breaks the rule.
    files: ["eslint-rules/**/*.js"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },
]);

export default eslintConfig;
