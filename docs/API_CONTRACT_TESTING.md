# API Contract Testing Standards

External API integrations must be treated as versioned interfaces rather than ad hoc JSON blobs.

## Contract rules

- Every external response must have a validating schema.
- Every contract must include a version string for compatibility monitoring.
- Contract validation must happen before the payload is used by application code.
- Breaking changes must be versioned and reviewed as part of the migration plan.

## Validation approach

This repository uses Zod schemas for validation at the boundary layer and a Jest suite to confirm contract compliance.

```ts
const ApiResponseSchema = z.object({
  version: z.literal("2026-08-28"),
  ok: z.boolean(),
  data: z.object({
    id: z.string(),
    status: z.enum(["ok", "error"]),
  }),
});
```

## Contract verification

Run:

```bash
npm test -- --runInBand __tests__/lib/apiContract.test.ts
```

This validates both happy-path payloads and rejection cases so incompatible upstream responses fail early and loudly.
