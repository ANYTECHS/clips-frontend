# Security

## Threat model overview

This document covers the primary attack surfaces in ClipCash: authenticated user flows, unauthenticated public entry points, third-party integrations, and Stellar wallet interactions.

### Authenticated surfaces

- Browser sessions and account management handled by NextAuth and the app's protected API routes.
- Upload, job processing, project, wallet, recovery, and billing routes that accept authenticated requests.
- Private data such as uploaded media, job state, wallet metadata, and recovery configuration.

### Unauthenticated surfaces

- Public pages and static assets.
- Authentication entry points and callback routes handled by NextAuth.
- Webhook-style endpoints such as `/api/jobs/[id]/callback` and other public APIs that must validate secrets and replay protection.
- Browser-visible content that can be influenced by user input.

### External dependencies

- The AI processing backend (outbound dispatches and callback webhooks).
- Cloud storage and virus scanning providers.
- Analytics providers and third-party scripts.
- Stellar Horizon / Soroban RPC / wallet extensions.
- Email delivery for guardian invitations and recovery flows.

### Stellar-specific concerns

- Wallet key theft or exfiltration from the browser.
- Malicious signing requests or transaction confusion.
- Replay of callbacks and other signed messages.
- Loss of access due to weak backup or recovery flows.

## Threat model

| Threat | Where it matters | Mitigations already in place | Open gaps |
| --- | --- | --- | --- |
| XSS | User-generated content rendered in the UI and browser-side state | CSP and security headers; the `sanitize` helper is used for user-controlled strings; the app avoids `dangerouslySetInnerHTML` | The app still relies on disciplined use of `sanitize` and careful render-path review; automated UI coverage does not exercise every render path. |
| CSRF | State-changing API routes, especially upload, job restart, project update, profile, and auth-extension routes | `checkCsrf()` validates `Origin`/`Referer` for mutating routes; NextAuth covers `/api/auth/*` routes | Coverage should be kept up as new mutating routes are added; a periodic route audit is still useful. |
| IDOR / broken object access | Routes that operate on a specific job, project, clip, recovery session, or wallet resource | Authenticated handlers resolve the signed-in identity and many routes are scoped to that identity | There is no single centralized authorization layer yet; object-level access should be tested for every new route. |
| Replay attacks on callbacks | AI backend callbacks to `/api/jobs/[id]/callback` | Shared secret (`AI_BACKEND_CALLBACK_SECRET`), timestamp validation, nonce cache with one-time consumption, and terminal-state guard | The nonce cache is in-memory and not shared across multiple app instances; production deployments should use a shared cache for strict replay protection. |
| File upload abuse | The video upload endpoint and cloud-storage pipeline | Authentication + CSRF protection; request size limits; file-type/extension validation; magic-byte inspection; quarantine + virus scanning; rate limiting | Larger or more complex malware families may evade checks; the upload pipeline would benefit from additional defense-in-depth such as stricter content policies and sandboxed scanning. |
| Wallet key theft | Embedded Stellar wallet and recovery flows | Client-side password-based encryption with Web Crypto (AES-GCM + PBKDF2), local-only storage of sensitive material, Sentry redaction for secrets, and Shamir-style recovery shares where supported | Browser compromise or XSS can still expose decrypted secrets; the app does not yet use hardware-backed key storage or a fully production-grade recovery back end. |

## Security headers and HTTP hardening

`next.config.ts` sets the following headers on every response via its `headers()` export:

| Header | Value |
| --- | --- |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | see below |

Verified by `tests/e2e/security-headers.spec.ts`.

### Content Security Policy (CSP)

The CSP is built in `next.config.ts` (`buildCsp()`). `script-src` and `connect-src` conditionally include the analytics domains below only when `NEXT_PUBLIC_ANALYTICS_PROVIDER` is `ga4` or `plausible` — without these entries, analytics providers would be silently blocked by the browser.

#### script-src

- `'self'`
- `https://www.googletagmanager.com` — Google Tag Manager (GA4 script loader) — analytics enabled only
- `https://plausible.io` — Plausible Analytics script — analytics enabled only

#### connect-src

- `'self'`
- `https://horizon-testnet.stellar.org` — Stellar testnet Horizon API
- `https://horizon.stellar.org` — Stellar mainnet Horizon API
- `https://api.coingecko.com` — XLM / asset price data
- `https://www.google-analytics.com` — GA4 data sends — analytics enabled only
- `https://plausible.io` — Plausible event API — analytics enabled only

#### img-src

- `'self'`, `data:`
- `https://api.dicebear.com` — Avatar generation
- `https://images.unsplash.com` — Stock photography

#### Other directives

- `default-src 'self'`
- `style-src 'self' 'unsafe-inline'`
- `frame-ancestors 'none'`

#### Live CSP value (analytics disabled, default)

```text
default-src 'self'; script-src 'self'; connect-src 'self' https://horizon-testnet.stellar.org https://horizon.stellar.org https://api.coingecko.com; img-src 'self' data: https://api.dicebear.com https://images.unsplash.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'
```

#### Live CSP value (`NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` or `plausible`)

```text
default-src 'self'; script-src 'self' https://www.googletagmanager.com https://plausible.io; connect-src 'self' https://horizon-testnet.stellar.org https://horizon.stellar.org https://api.coingecko.com https://www.google-analytics.com https://plausible.io; img-src 'self' data: https://api.dicebear.com https://images.unsplash.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'
```

#### Testing

After configuring CSP headers, verify that no console violations appear when each analytics provider is enabled. Use the following procedure:

1. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` and verify GA4 events appear in the network tab with no CSP errors.
2. Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible` and verify Plausible events appear in the network tab with no CSP errors.
3. Confirm that `cookie-consent` changes trigger and revoke analytics tracking without CSP violations.
4. Run `tests/e2e/security-headers.spec.ts` to confirm headers are present on all responses.

## Subresource integrity (SRI) for analytics scripts

Both analytics scripts in `app/lib/analytics.ts` are injected at runtime via
`document.createElement('script')` (only after the user has granted
analytics consent — see `checkConsent()`), and both now set
`crossOrigin="anonymous"` unconditionally. An `integrity` attribute is
applied *only* when the corresponding env var below is set, because pinning
a hash to a script neither of these vendors serves via an immutable
versioned URL carries a real availability risk: if the vendor updates the
script and the configured hash goes stale, the browser refuses to execute
it and tracking silently breaks until the hash is rotated.

| Env var | Script | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_GA4_SCRIPT_SRI_HASH` | `googletagmanager.com/gtag/js` | **Not recommended.** Google explicitly does not support SRI for `gtag.js` — it's generated per measurement ID and can change without notice. Only set this if you've accepted that tracking can silently stop working on a Google-side change, and you're rotating the hash proactively. |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH` | `plausible.io/js/script.js` (or `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` if pinned to a mirrored/self-hosted copy) | Plausible's hosted script has no first-party versioned URL, so "pinning a version" in practice means pinning an SRI hash of a known-good snapshot and refreshing it deliberately (see below), or self-hosting a specific release. |

### Computing/rotating a hash

```bash
curl -s https://plausible.io/js/script.js -o script.js
openssl dgst -sha256 -binary script.js | openssl base64 -A
# => prefix the output with "sha256-" and set it as
#    NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRI_HASH
```

Re-run this whenever the vendor's script legitimately changes (e.g. after
confirming a Plausible release note), then redeploy with the new hash.
`node scripts/verify-script-sri.js` (wired into CI — see the PR description
for the workflow snippet, since this token cannot push
`.github/workflows/**` changes) re-downloads each *configured* script and
fails if its hash no longer matches, so a silent vendor-side change is
caught instead of quietly breaking analytics in production. A script with
no `*_SCRIPT_SRI_HASH` set is skipped, not failed.

## Reporting security issues

Please report vulnerabilities privately to `security@clipcash.ai`. Include a summary, affected endpoint or route, steps to reproduce, potential impact, and any relevant logs or proof of concept. Do not open public issues for unpatched vulnerabilities. We aim to acknowledge reports promptly and coordinate remediation responsibly.
