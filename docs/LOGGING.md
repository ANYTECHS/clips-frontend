# Logging Practices

How this codebase logs, and what happens to each level in development and in
production. The implementation is [`app/lib/logger.ts`](../app/lib/logger.ts);
the lint rule that keeps it the only path is in
[`eslint.config.mjs`](../eslint.config.mjs).

## Why `console` is banned in production source

A `console.log` in shipped code goes to the browser or server console and
nowhere else. Nobody has devtools open on a production session, so the line is
invisible exactly when it would matter — and it never reaches Sentry, so a
fault it describes leaves no trace. `no-console` is therefore an **error**
across `app/**`, `components/**` and `hooks/**`, not a warning.

The only exemptions are `app/lib/logger.ts` itself (its `consoleFallback` is
the implementation), Storybook stories, test files, and Node scripts under
`scripts/**`, where `console` is the program's actual output rather than a
leak. `public/sw.js` keeps the looser global rule, since a service worker has
no access to the logger.

## The API

```ts
import { logger } from "@/app/lib/logger";

logger.debug("cache miss", { key });
logger.info("project created", { projectId });
logger.warn("retrying upload", { attempt });
logger.error("checkout failed", err);
```

Every method takes variadic arguments. Strings are joined as-is; anything else
is JSON-encoded and appended.

## Choosing a level

| Level   | Use it for                                                                                          | Development                                                       | Production                |
| ------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| `debug` | Traces you would only want while actively debugging — cache hits, retry attempts, state transitions | `console.debug`                                                   | **dropped**               |
| `info`  | Normal significant events: a resource was created, a user completed a flow                          | `console.info`                                                    | Sentry breadcrumb         |
| `warn`  | Something recoverable went wrong, or a fallback was used                                            | `console.warn`                                                    | Sentry event + breadcrumb |
| `error` | An operation failed                                                                                 | `console.error`, plus `captureException` if an `Error` was passed | Sentry event + breadcrumb |

The asymmetry is deliberate. `debug` is the level for anything that would be
noise at scale, which is what makes it safe to leave in the code — it costs
nothing in production and is there when you need it. Reach for `info` when the
event is genuinely worth a breadcrumb in a production crash report.

## Pass the Error object, never a string

```ts
logger.error("checkout failed", err); // right
logger.error("checkout failed", err.message); // wrong
```

Passing the object is what lets Sentry attach a real stack trace and what
triggers `captureException`. `String(err)` or `err.message` flattens it to a
line of text with no stack, which is usually the difference between a
diagnosable report and a useless one. The codebase previously had 15 call
sites interpolating `err.message` into user-facing strings; the
`local/error-message-style` rule (see [ERROR_HANDLING.md](./ERROR_HANDLING.md))
now prevents that shape from coming back.

One consequence worth knowing: an `Error` argument is captured even when
`NODE_ENV` is not `production`, so errors reach Sentry from any environment
that has a DSN configured. Everything else routes to `console`.

## Remote drain

Set `LOG_DRAIN_URL` and `info` and above are also batched and POSTed there.
Entries flush when the batch reaches **50** entries or **100 ms** elapses,
whichever comes first, preferring `navigator.sendBeacon` so a log survives page
unload. Network failures are swallowed — a logging outage must never surface as
an application error.

`debug` is never drained.

## Testing

[`__tests__/lib/logger.test.ts`](../__tests__/lib/logger.test.ts) covers the
per-level behaviour above. Two things to know if you extend it:

- The logger reads `NODE_ENV` and `LOG_DRAIN_URL` into module constants **at
  import time**, so a test that cares about either must reload the module with
  the environment already set. The file's `loadLogger` helper does this.
- The Sentry mock is a single shared object, not an inline factory.
  `jest.resetModules()` re-runs mock factories, so an inline factory would hand
  the reloaded logger fresh `jest.fn()`s while the test still held the
  originals — and every assertion would silently see zero calls.

## See also

- [ERROR_HANDLING.md](./ERROR_HANDLING.md) — user-facing message standards
- [`scripts/check-lint.js`](../scripts/check-lint.js) — the CI ratchet that
  stops regressions in `no-console` and the other cleanup rules
