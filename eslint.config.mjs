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
    files: ["app/**/*.ts", "app/**/*.tsx"],
    rules: {
      "no-magic-numbers": [
        "warn",
        {
          ignore: [
            0, 1, 2, 3, 5, 8, -1, 100, 1000, 1024, 60, 24, 7, 12, 200, 201, 204, 301, 302, 400, 401,
            403, 404, 429, 500, 502, 503,
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
]);

export default eslintConfig;
