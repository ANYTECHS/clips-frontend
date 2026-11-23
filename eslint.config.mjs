import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Issue #1347 — circular imports break tree-shaking; see docs/IMPORT_STANDARDS.md.
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  {
    // Issue #1347 — layering: lib/ is the bottom layer and must not reach up
    // into UI (components/) or routes (app/).
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/components/*", "@/app/*"], message: "lib/ must not import from components/ or app/ (see docs/IMPORT_STANDARDS.md)." },
          ],
        },
      ],
    },
  },
  {
    // components/ must not depend on route modules in app/.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/app/*"], message: "components/ must not import from app/ (see docs/IMPORT_STANDARDS.md)." },
          ],
        },
      ],
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
