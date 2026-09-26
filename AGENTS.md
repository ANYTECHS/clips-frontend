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

## Code Style
- **No nested ternaries**: Do not nest ternary operators. When a conditional has more than two branches, or when a ternary would appear inside another ternary, use `if`/`else` statements (or a `switch`) instead. This keeps branching logic readable and easy to test.
