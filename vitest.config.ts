import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

/**
 * Vitest config. Tests target framework-agnostic modules (the i18n module,
 * the shared API response helpers) and the Next.js API route handlers, which
 * only need the Web Fetch API — the Node environment is sufficient, no DOM or
 * React runtime is required.
 */
export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json so route handlers that
    // import `@/lib/...` can be loaded by the API contract tests.
    alias: {
      "@": resolve(fileURLToPath(new URL(".", import.meta.url))),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "app/api/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
