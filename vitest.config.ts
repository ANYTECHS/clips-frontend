import { defineConfig } from "vitest/config";

/**
 * Vitest config. Tests target the framework-agnostic i18n module (pure
 * functions + the Intl API), so the Node environment is sufficient — no DOM
 * or React runtime is required.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
