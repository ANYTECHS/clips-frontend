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
    // Issue #1390 — API routes must build JSON responses with the shared
    // helpers in lib/apiResponse.ts so every error uses the standard
    // `{ error, message, code? }` envelope.
    files: ["app/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='NextResponse'][callee.property.name='json']",
          message: "Use apiJson()/apiError() from '@/lib/apiResponse' instead of NextResponse.json().",
        },
        {
          selector: "CallExpression[callee.object.name='Response'][callee.property.name='json']",
          message: "Use apiJson()/apiError() from '@/lib/apiResponse' instead of Response.json().",
        },
      ],
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
