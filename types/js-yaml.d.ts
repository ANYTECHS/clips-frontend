// Minimal typings for js-yaml (already installed through ESLint), used by the
// OpenAPI contract tests to read docs/openapi.yaml.
declare module "js-yaml" {
  export function load(input: string, options?: Record<string, unknown>): unknown;
}
