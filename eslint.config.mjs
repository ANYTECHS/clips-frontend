// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Exclude test files from no-console
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}", "**/__tests__/**", "**/__mocks__/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["app/**/*.ts", "app/**/*.tsx"],
    rules: {
      "no-magic-numbers": ["warn", {
        ignore: [0, 1, 2, 3, 5, 8, -1, 100, 1000, 1024, 60, 24, 7, 12, 200, 201, 204, 301, 302, 400, 401, 403, 404, 429, 500, 502, 503],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
      }],
    },
  },
  {
    files: ["app/hooks/**/*.ts", "app/hooks/**/*.tsx", "app/lib/**/*.ts", "app/lib/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration[id.name=/^mock/]",
          message: "Functions starting with 'mock' must not be exported from production source files. Move them to __tests__/mocks/ or __mocks__/.",
        },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^mock/]",
          message: "Variables/constants starting with 'mock' must not be exported from production source files. Move them to __tests__/mocks/ or __mocks__/.",
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
              message: "Store files must not import from mockApi directly. Use the ./api barrel export instead.",
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
]);

export default eslintConfig;
