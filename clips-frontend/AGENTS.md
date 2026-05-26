<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Security Guidelines
- **Sanitization**: All user-controlled strings reflected in the UI must be sanitized using the `sanitize` utility in `@/app/lib/sanitize.ts` to prevent XSS attacks.
- **dangerousSetInnerHTML**: Never use `dangerouslySetInnerHTML` without explicit sanitization from a trusted library like DOMPurify.
