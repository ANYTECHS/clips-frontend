<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Security Guidelines
- **Sanitization**: All user-controlled strings reflected in the UI must be sanitized using the `sanitize` utility in `@/app/lib/sanitize.ts` to prevent XSS attacks.
- **dangerousSetInnerHTML**: Never use `dangerouslySetInnerHTML` without explicit sanitization from a trusted library like DOMPurify.

## Component Demos
- Do not add public App Router pages for internal component demos. Use Storybook (`npm run storybook`) as the canonical demo environment.
- Any dev-only demo routes must return 404 in production (`NODE_ENV === "production"`).

## Export Conventions
- **Named exports are the standard.** Always export modules using named exports (`export function Foo`, `export const foo`).
- **Do not use default exports** for components, utilities, hooks, or types. Default exports make imports inconsistent and hinder refactoring.
- **Imports**: Import named exports directly (`import { Foo } from "@/app/components/Foo"`). Do not use default-import syntax for internal modules.
- **Enforcement**: The `import/no-default-export` ESLint rule is enabled to catch new default exports. Existing default exports should be converted to named exports and their imports updated.
- **Exceptions**: Next.js App Router special files (`page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `template.tsx`, `default.tsx`, `route.ts`, `middleware.ts`) and config files (`next.config.js`, `tailwind.config.js`, etc.) may require default exports per framework conventions; these are exempt.
