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
    },
  },
  {
    // Issue #1249 — API routes must build JSON through app/api/apiResponse.ts
    // so every response (and especially every error) has the same shape.
    files: ["app/api/**/route.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name=/^(NextResponse|Response)$/][callee.property.name='json']",
          message:
            "Use success()/error()/paginated() from app/api/apiResponse.ts instead of constructing JSON responses directly.",
        },
        {
          selector:
            "NewExpression[callee.name=/^(NextResponse|Response)$/] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
          message:
            "Use success()/error() from app/api/apiResponse.ts instead of serialising JSON responses by hand.",
        },
      ],
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
