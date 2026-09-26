# Error handling and user-facing messages

Issue #1109. Enforced by the `local/error-message-style` rule in
`eslint.config.mjs`; all messages live in `app/lib/errorMessages.ts`.

This document covers the messages a **user reads**. For the error codes an
**API caller receives** (`UNAUTHORIZED`, `RATE_LIMITED`, …) see
[API_ERROR_CODES.md](./API_ERROR_CODES.md) — that is a machine contract, this is
copy.

## The problem this fixes

Error copy had drifted into four conventions doing the same job:

```ts
setError("Passwords do not match"); // no period
setError("Failed to load analytics"); // no period, "Failed to"
setError("Checkout error"); // not a sentence
setError("Something went wrong"); // no period, no next step
setError("Decryption failed. Check your password and try again."); // period, guidance
```

Reading any one of these in isolation it looks fine. The inconsistency is only
visible across the app, which is exactly where a user meets it — so a rule that
is obvious in review was invisible in the diff.

There was a worse problem underneath. Fifteen call sites did this:

```ts
setError(err.message || "Failed to load earnings");
```

`err.message` is whatever the thrown `Error` happened to carry. That rendered
`"Request failed with status 502"`, endpoint paths, and ORM constraint names
into the UI, in a codebase whose other errors were carefully phrased. Users got
system vocabulary in a sentence they could not act on.

## The standard

Every user-facing message is one of two kinds. The kind determines the shape;
mixing them is what produced the drift.

### 1. Validation — the user can fix it

| Rule       |                                   |
| ---------- | --------------------------------- |
| Opens with | `Please`                          |
| Names      | the field or action, not the rule |
| Ends with  | a period                          |

```
Please enter your account email address.
Please select a backup file.
Please add at least two guardians with email addresses.
Passwords must match.
```

### 2. Failure — the system could not do it

| Rule        |                                                           |
| ----------- | --------------------------------------------------------- |
| Opens with  | `We couldn't` — the failure is not attributed to the user |
| States      | what failed, in the user's terms                          |
| Closes with | a next step, when one exists                              |
| Ends with   | a period                                                  |

```
We couldn't load your wallet. Please try again.
We couldn't run that search. Please try again.
We couldn't decrypt that backup. Please check your password and try again.
We couldn't load this project. It may have been deleted.
```

### Writing a new message

- **Never interpolate a caught error.** `safeErrorMessage` sends the real error
  to the log and returns the constant.
- **No status codes, stack traces, or `null`/`undefined`.** If the user cannot
  act on it, it belongs in the log.
- **No "Failed to".** It reads as the user's failure and is passive. Use
  `We couldn't`.
- **One sentence where possible, two at most.** The second sentence is the next
  step, not more explanation.
- **Say what to do, not what went wrong internally.** "Please try again" and
  "It may have been deleted" help; "unexpected response shape" does not.

## Using the catalogue

```ts
import {
  FAILURE_MESSAGES,
  VALIDATION_MESSAGES,
  safeErrorMessage,
  tooManyAttempts,
} from "@/app/lib/errorMessages";

// Validation — the user can retype.
if (!email) {
  setError(VALIDATION_MESSAGES.emailRequired);
  return;
}

// Failure — the system could not. The real error is logged, not rendered.
} catch (err) {
  setError(safeErrorMessage(err, FAILURE_MESSAGES.loadWallet, "load wallet"));
}
```

`safeErrorMessage(error, fallback, context?)`
: Logs `error` through `app/lib/logger.ts` and returns `fallback` verbatim. The
third argument is a short slug identifying the operation, so the log line is
greppable. Returns `fallback` unchanged, so passing a catalogue constant
guarantees the rendered text is the constant.

`tooManyAttempts(countdown)`
: Rate-limit copy that interpolates the remaining wait. A function rather than a
template constant so a call site cannot forget to substitute and ship a
literal `{{countdown}}` to a user.

## When not to use the catalogue

- **Server-provided messages you deliberately surface.** Where an API returns a
  message written _for the user_ (see `apiFetch` in `app/lib/apiError.ts`,
  which reads `body.error`), pass it through. The line is intent: a message
  authored for display is copy; a thrown `Error` is a diagnostic.
- **Headings.** `"Something went wrong"` as an `<h2>` is a title, not a
  message, and reads correctly without a period. The rule checks `setError`-style
  calls only, so headings are unaffected.
- **Field-level validation from a form library.** Those render inline against
  the input and follow the library's own conventions.

## Enforcement

`local/error-message-style` checks the string passed to `setError`,
`setErrorMessage`, `setErr`, `setFormError`, and `setStatusMessage` for:

1. **Punctuation** — an inline literal must end with `.`, `!`, or `?`.
2. **Internal detail** — no `HTTP`, `404`, `undefined`, `null`, stack traces,
   or `Error:` prefixes.
3. **Error passthrough** — no `${err.message}`-style interpolation.

The rule only inspects inline literals. A constant from the catalogue is not a
literal and is never re-checked, so the message is written once and every call
site inherits it — that indirection is the mechanism, not a side effect.

It deliberately does **not** check tone, voice, or sentence case. A regex can
verify a period; it cannot verify that "We couldn't load your wallet" is better
copy than "Wallet load failed". Half-enforcing tone would produce false
confidence, so tone is left to review against the examples above.

## Tests

`__tests__/lib/errorMessages.test.ts` asserts the catalogue's structural
invariants — that every message satisfies the standard's punctuation and
vocabulary rules. It runs over the catalogue rather than over a hand-picked
list, so a message added later is covered the moment it is added.

## See also

- [`app/lib/errorMessages.ts`](../app/lib/errorMessages.ts) — the catalogue
- [`docs/API_ERROR_CODES.md`](./API_ERROR_CODES.md) — the machine-readable codes
- [`eslint-rules/error-message-style.js`](../eslint-rules/error-message-style.js) — the rule
