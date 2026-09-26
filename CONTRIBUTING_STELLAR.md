# Contributing to Stellar Wallet Features

This guide covers everything you need to work on wallet-related code in ClipCash AI. Read it before opening a PR that touches anything in `app/hooks/`, `app/lib/stellar*`, `components/wallet/`, or `components/wallet-provider.tsx`.

---

## Table of Contents

1. [Getting started](#getting-started)
2. [Development setup](#development-setup)
3. [Architecture overview](#architecture-overview)
4. [File map](#file-map)
5. [Core concepts](#core-concepts)
6. [How to add a new Stellar operation](#how-to-add-a-new-stellar-operation)
7. [How to add a new wallet hook](#how-to-add-a-new-wallet-hook)
8. [How to add a new wallet UI component](#how-to-add-a-new-wallet-ui-component)
9. [Signing modes](#signing-modes)
10. [Network configuration](#network-configuration)
11. [Analytics requirements](#analytics-requirements)
12. [Security rules](#security-rules)
13. [Testing checklist](#testing-checklist)
14. [Contribution guidelines](#contribution-guidelines)
15. [Code review process](#code-review-process)
16. [Good first issues](#good-first-issues)
17. [Communication](#communication)
18. [Common mistakes](#common-mistakes)

---

## Getting started

New to the project? Follow these steps in order:

1. Read this guide end to end — it is the onboarding path for wallet work.
2. Complete [Development setup](#development-setup) and confirm the dev server runs.
3. Skim the [Architecture overview](#architecture-overview) and [File map](#file-map) so you know where code lives.
4. Pick a task from the [Good first issues](#good-first-issues) list.
5. Open a draft PR early and ask questions in the channels listed under [Communication](#communication).

---

## Development setup

### Prerequisites

- Node.js 18+ and npm (use the version pinned in `package.json` / `.nvmrc` if present)
- A Stellar testnet account (funded via Friendbot — see below)
- The [Freighter](https://www.freighter.app/) browser extension for extension-based signing

### Install and run

```bash
npm install          # install dependencies
cp .env.example .env.local   # create local env file (if .env.example exists)
npm run dev          # start the Next.js dev server on http://localhost:3000
```

### Environment variables

Wallet code reads its configuration from environment variables. At minimum set:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet   # testnet | mainnet
```

Never commit real secrets. Use testnet keys locally and keep `.env.local` out of version control.

### Tests and checks

```bash
npm test             # run the test suite
npm run lint         # lint the codebase
npm run build        # verify a production build compiles
```

Run these before opening a PR. If a command is not defined in `package.json`, use the closest equivalent and note it in your PR description.

### Funding a testnet account

Use Friendbot (via `fundWithFriendbot` in `app/lib/stellar.ts`) to get test XLM. Never use mainnet keys during development.

---

## Architecture overview

```
Environment variable
  NEXT_PUBLIC_STELLAR_NETWORK=testnet|mainnet
          │
          ▼
  app/lib/network-config.ts          ← single source of truth for URLs/passphrases
          │
          ├── app/lib/stellar.ts    ← Stellar SDK wrappers, buildBatchTransaction
          │         │
          │         └── app/lib/stellar-operations.ts  ← typed operation descriptors
          │
          ├── app/hooks/use*.ts     ← React hooks (no direct SDK calls in components)
          │
          └── components/wallet/   ← UI components (consume hooks only)
                    │
                    └── components/wallet-provider.tsx  ← session + signing for embedded wallets
```

**Key rule:** Components never import `@stellar/stellar-sdk` directly. All SDK usage lives in `app/lib/` or hooks.

---

## File map

| File | Responsibility |
|------|---------------|
| `app/lib/network-config.ts` | Horizon URLs, passphrases, Friendbot URL, network label |
| `app/lib/stellar.ts` | `buildBatchTransaction`, `buildPaymentTransaction`, `getBalance`, `fundWithFriendbot` |
| `app/lib/stellar-operations.ts` | Typed operation descriptors + builder helpers + `validateOperations` |
| `app/lib/stellar-transaction.ts` | Low-level XDR envelope builder used in tests |
| `app/hooks/use-wallet-connection.ts` | Freighter browser extension connect/disconnect |
| `app/hooks/use-auto-stellar-wallet.ts` | Loads wallet from auth context, no manual connect needed |
| `app/hooks/use-balance.ts` | Balance polling with auto-refresh and USD conversion |
| `app/hooks/use-stellar-transaction.ts` | Freighter-based transaction execution + batch queue |
| `app/hooks/use-trustline.ts` | Add/remove asset trustlines (embedded or Freighter) |
| `app/hooks/useWalletHealth.ts` | Horizon latency, account status, connection quality |
| `components/wallet-provider.tsx` | React context: embedded wallet session, `sendXlmPayment`, `refreshBalance` |
| `components/wallet/trustline-manager.tsx` | Trustline UI (preset + custom assets) |
| `components/wallet/wallet-health-card.tsx` | Health status display |
| `components/wallet/BalanceDisplay.tsx` | XLM + USD balance display with auto-refresh |
| `components/wallet/TransactionHistory.tsx` | Recent transaction list |
| `app/lib/wallet-error-tracking.ts` | Sentry integration + structured error logging |
| `app/lib/analytics.ts` | Analytics events for all wallet actions |

---

## Core concepts

### Operation descriptors

All Stellar operations are represented as plain TypeScript objects before they touch the SDK. This keeps business logic testable without mocking the SDK.

```ts
// stellarOperations.ts exports a discriminated union:
type StellarOperation =
  | PaymentOperation
  | ChangeTrustOperation
  | ManageSellOfferOperation
  | ManageBuyOfferOperation
  | AccountMergeOperation
  | SetOptionsOperation
  | InvokeContractOperation;
```

Always use the builder helpers — never construct the raw object manually:

```ts
import { createChangeTrustOp, createPaymentOp } from "@/app/lib/stellar-operations";

const ops = [
  createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G...", limit: "1000" }),
  createPaymentOp({ destination: "G...", amount: "10", assetCode: "USDC", assetIssuer: "G..." }),
];
```

### Batch transactions

Multiple operations can be submitted in a single atomic transaction (Stellar allows up to 100). Use `buildBatchTransaction` from `app/lib/stellar.ts`:

```ts
import { buildBatchTransaction } from "@/app/lib/stellar";

const { xdr, feeStroops, operationCount } = await buildBatchTransaction(
  senderPublicKey,
  ops,
  { memo: "optional memo", timeoutSeconds: 30 }
);
// xdr is unsigned — pass it to Freighter or sign with a keypair
```

Fee is automatically scaled: `baseFee × operationCount`.

### Memo length limit

Stellar memo text is limited to **28 bytes**. Always slice:

```ts
const memo = `Add ${assetCode}`.slice(0, 28);
```

### Amounts are strings

The Stellar SDK uses string amounts to avoid floating-point precision loss. Always pass amounts as strings (`"10.5"`, not `10.5`).

---

## How to add a new Stellar operation

1. **Add the interface** to `app/lib/stellar-operations.ts`:

```ts
export interface MyNewOperation {
  type: "my_new_op";
  requiredField: string;
  optionalField?: string;
  source?: string;
}
```

2. **Add it to the union**:

```ts
export type StellarOperation =
  | PaymentOperation
  | ChangeTrustOperation
  // ...
  | MyNewOperation;   // ← add here
```

3. **Add a builder helper**:

```ts
export function createMyNewOp(
  params: Omit<MyNewOperation, "type">
): MyNewOperation {
  return { type: "my_new_op", ...params };
}
```

4. **Add validation** in `validateOperations`:

```ts
case "my_new_op":
  if (!op.requiredField) {
    throw new BatchValidationError(i, "my_new_op requires requiredField.");
  }
  break;
```

5. **Add SDK conversion** in `toSdkOperation` inside `app/lib/stellar.ts`:

```ts
case "my_new_op":
  return StellarSdk.Operation.myNewOp({
    requiredField: op.requiredField,
    ...(op.source ? { source: op.source } : {}),
  });
```

6. **The exhaustiveness check** (`const _exhaustive: never = op`) will cause a compile error if you forget step 5 — that's intentional.

---

## How to add a new wallet hook

Follow the pattern established by `useTrustline` and `useWalletHealth`.

```ts
"use client";

import { useState, useCallback } from "react";
// Import from lib, never directly from @stellar/stellar-sdk in hooks
import { buildBatchTransaction, NETWORK_PASSPHRASE, getStellarServer } from "@/app/lib/stellar";
import { STELLAR_NETWORK } from "@/app/lib/network-config";
import analytics from "@/lib/analytics";

export type MyFeatureStatus = "idle" | "loading" | "success" | "error";

export interface MyFeatureError {
  code: string;
  message: string;
}

export function useMyFeature(options: { onSuccess?: () => void } = {}) {
  const [status, setStatus] = useState<MyFeatureStatus>("idle");
  const [error, setError] = useState<MyFeatureError | null>(null);

  const doSomething = useCallback(async (params: { publicKey: string }) => {
    setStatus("loading");
    setError(null);
    try {
      // ... implementation
      setStatus("success");
      analytics.trackEvent("my_feature_used", { network: STELLAR_NETWORK });
      options.onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus("error");
      setError({ code: "MY_FEATURE_ERROR", message: msg });
    }
  }, [options]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, isLoading: status === "loading", error, doSomething, reset };
}
```

Rules:
- Export a `reset()` function so callers can clear state before retrying.
- Expose `isLoading` as a boolean derived from `status` — components should not need to compare status strings.
- Always call the relevant `analytics.track*` method on success (see [Analytics requirements](#analytics-requirements)).
- Use `isMountedRef` if the hook sets state inside async callbacks that outlive the component.

---

## How to add a new wallet UI component

1. Place the component in `components/wallet/`.
2. Consume data through hooks — never call the SDK or Horizon directly.
3. Handle the four states explicitly: loading, empty, error, success.
4. Surface errors with a user-readable message and a retry action.
5. Add the component to the relevant page and verify it on testnet.

---

## Signing modes

Wallet code supports two signing paths:

- **Embedded wallet** — session managed by `components/WalletProvider.tsx`; use `sendXlmPayment` / `refreshBalance` from the context.
- **Freighter extension** — connect via `useWalletConnection`, sign via `useStellarTransaction`.

Hooks such as `useTrustline` accept both and pick the correct path based on the active session. Do not hard-code a single signing mode.

---

## Network configuration

**Never hardcode network strings or URLs.** Always read from `networkConfig.ts`:

```ts
import {
  STELLAR_NETWORK,          // "testnet" | "mainnet"
  ACTIVE_NETWORK_CONFIG,    // full config object for the active network
  getHorizonUrl,
  getNetworkPassphrase,
  getFriendbotUrl,          // throws on mainnet — use this intentionally
  getFreighterNetwork,      // "PUBLIC" | "TESTNET" for Freighter API
} from "@/app/lib/network-config";
```

The active network is set by the `NEXT_PUBLIC_STELLAR_NETWORK` environment variable. Default is `testnet`.

To test against mainnet locally:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=mainnet npm run dev
```

`getFriendbotUrl()` deliberately throws when called on mainnet. If your code calls it, wrap it in a guard:

```ts
if (STELLAR_NETWORK === "testnet") {
  await fundWithFriendbot(publicKey);
}
```

---

## Analytics requirements

Every user-facing wallet action must emit an analytics event via `app/lib/analytics.ts`. Add a `track*` method for new actions and call it on success. Include the network in the payload so testnet and mainnet usage can be separated.

---

## Security rules

These are non-negotiable. PRs that violate them will not be merged.

**Never log or expose secret keys.**
```ts
// ✗ wrong
console.log("secret:", secretKey);

// ✓ correct — log only the public key, redacted
logWalletOperation("connect_stellar", "success", { walletAddress: addr });
```

**Never pass secret keys as URL parameters or in analytics events.**

**Always sanitize user-controlled strings** before rendering them in the UI. Use `sanitize` from `@/app/lib/sanitize.ts`.

**Never use `dangerouslySetInnerHTML`** without explicit DOMPurify sanitization.

**Validate all Stellar addresses** before using them in transactions:
```ts
// Stellar public keys: G + 55 base32 characters
const isValidStellarAddress = (addr: string) =>
  /^G[A-Z2-7]{55}$/.test(addr);
```

**Use `AbortSignal.timeout`** on all `fetch` calls to Horizon to prevent indefinite hangs:
```ts
await fetch(url, { signal: AbortSignal.timeout(5_000) });
```

**Never call `getFriendbotUrl()` on mainnet.** The function throws intentionally — do not catch and suppress that error.

**Error tracking:** Use `captureWalletError` and `logWalletOperation` from `@/app/lib/wallet-error-tracking.ts` for all wallet errors. These sanitize PII before sending to Sentry.

```ts
import { captureWalletError, logWalletOperation } from "@/app/lib/wallet-error-tracking";

try {
  // ...
  logWalletOperation("connect_stellar", "success", { walletAddress: addr });
} catch (err) {
  captureWalletError(err, "connect_stellar", { walletType: "stellar" });
  throw err;
}
```

---

## Testing checklist

Before opening a PR, confirm:

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` compiles
- [ ] New operations have validation + SDK conversion + tests
- [ ] New hooks expose `reset()` and `isLoading`
- [ ] New UI handles loading, empty, error, and success states
- [ ] Analytics events fire on success
- [ ] Verified manually on testnet

---

## Contribution guidelines

### Branching

- Branch from `main`.
- Use a descriptive name: `feat/wallet-trustline-ui`, `fix/balance-refresh`, `docs/contributor-guide`.

### Commits

- Write clear, imperative commit messages (`fix: handle empty balance response`).
- Keep commits focused; avoid mixing unrelated changes.

### Pull requests

- Keep PRs small and scoped to one issue.
- Fill in the PR template: what changed, why, and how it was tested.
- Link the issue being addressed (e.g. `Closes #1132`).
- Add screenshots or a short clip for UI changes.
- Ensure CI is green before requesting review.

### Changesets

If the repo uses changesets, add one for user-facing changes:

```bash
npx changeset
```

Follow the prompts and commit the generated file with your PR.

---

## Code review process

1. **Open a draft PR early** for large changes so reviewers can course-correct.
2. **Request review** from a maintainer once CI passes and the description is complete.
3. **Address feedback** with new commits — do not force-push over review history unless asked.
4. **Approval and merge** — a maintainer approves and merges once the checklist is satisfied. Squash-merge is the default.

Reviewers look for: correctness, test coverage, adherence to the architecture rules above, security implications, and clear commit/PR descriptions.

---

## Good first issues

New contributors should start with issues labeled `good first issue`. Typical starter tasks:

- Add or improve tests for an existing hook in `app/hooks/`.
- Improve error messages in a wallet component.
- Add a missing analytics event for an existing action.
- Fix a UI edge case (empty state, loading state) in `components/wallet/`.
- Improve documentation in this guide or the README.

Browse the issue tracker and filter by the `good first issue` label to find current openings.

---

## Communication

- **Questions and help:** open a discussion or comment on the relevant issue.
- **Bug reports:** open an issue with reproduction steps and the network used.
- **Feature proposals:** open an issue describing the problem before writing code.
- **Reviews:** respond to review comments in the PR thread so context stays together.

Be respectful and assume good intent — see the project `CODE_OF_CONDUCT.md` if present.

---

## Common mistakes

- [Stellar Developer Docs](https://developers.stellar.org/)
- [Horizon API Reference](https://developers.stellar.org/api/horizon)
- [Freighter Wallet Docs](https://docs.freighter.app/)
- [`useWalletConnection` README](app/hooks/use-wallet-connection.README.md)
- [`useStellarTransaction` README](app/hooks/use-stellar-transaction.README.md)
- [Analytics guide](ANALYTICS.md)
