# Contributing to Stellar Wallet Features

This guide covers everything you need to work on wallet-related code in ClipCash AI. Read it before opening a PR that touches anything in `app/hooks/`, `app/lib/stellar*`, `components/wallet/`, or `components/WalletProvider.tsx`.

---

## Table of Contents

1. [Architecture overview](#architecture-overview)
2. [File map](#file-map)
3. [Core concepts](#core-concepts)
4. [How to add a new Stellar operation](#how-to-add-a-new-stellar-operation)
5. [How to add a new wallet hook](#how-to-add-a-new-wallet-hook)
6. [How to add a new wallet UI component](#how-to-add-a-new-wallet-ui-component)
7. [Signing modes](#signing-modes)
8. [Network configuration](#network-configuration)
9. [Analytics requirements](#analytics-requirements)
10. [Security rules](#security-rules)
11. [Testing checklist](#testing-checklist)
12. [Common mistakes](#common-mistakes)

---

## Architecture overview

```
Environment variable
  NEXT_PUBLIC_STELLAR_NETWORK=testnet|mainnet
          │
          ▼
  app/lib/networkConfig.ts          ← single source of truth for URLs/passphrases
          │
          ├── app/lib/stellar.ts    ← Stellar SDK wrappers, buildBatchTransaction
          │         │
          │         └── app/lib/stellarOperations.ts  ← typed operation descriptors
          │
          ├── app/hooks/use*.ts     ← React hooks (no direct SDK calls in components)
          │
          └── components/wallet/   ← UI components (consume hooks only)
                    │
                    └── components/WalletProvider.tsx  ← session + signing for embedded wallets
```

**Key rule:** Components never import `@stellar/stellar-sdk` directly. All SDK usage lives in `app/lib/` or hooks.

---

## File map

| File | Responsibility |
|------|---------------|
| `app/lib/networkConfig.ts` | Horizon URLs, passphrases, Friendbot URL, network label |
| `app/lib/stellar.ts` | `buildBatchTransaction`, `buildPaymentTransaction`, `getBalance`, `fundWithFriendbot` |
| `app/lib/stellarOperations.ts` | Typed operation descriptors + builder helpers + `validateOperations` |
| `app/lib/stellarTransaction.ts` | Low-level XDR envelope builder used in tests |
| `app/hooks/useWalletConnection.ts` | Freighter browser extension connect/disconnect |
| `app/hooks/useAutoStellarWallet.ts` | Loads wallet from auth context, no manual connect needed |
| `app/hooks/useBalance.ts` | Balance polling with auto-refresh and USD conversion |
| `app/hooks/useStellarTransaction.ts` | Freighter-based transaction execution + batch queue |
| `app/hooks/useTrustline.ts` | Add/remove asset trustlines (embedded or Freighter) |
| `app/hooks/useWalletHealth.ts` | Horizon latency, account status, connection quality |
| `components/WalletProvider.tsx` | React context: embedded wallet session, `sendXlmPayment`, `refreshBalance` |
| `components/wallet/TrustlineManager.tsx` | Trustline UI (preset + custom assets) |
| `components/wallet/WalletHealthCard.tsx` | Health status display |
| `components/wallet/BalanceDisplay.tsx` | XLM + USD balance display with auto-refresh |
| `components/wallet/TransactionHistory.tsx` | Recent transaction list |
| `app/lib/walletErrorTracking.ts` | Sentry integration + structured error logging |
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
import { createChangeTrustOp, createPaymentOp } from "@/app/lib/stellarOperations";

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

1. **Add the interface** to `app/lib/stellarOperations.ts`:

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
import { STELLAR_NETWORK } from "@/app/lib/networkConfig";
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
- Use `isMountedRef` if the hook sets state inside async callbacks that outlive the component (see `useWalletHealth.ts` for the pattern).

---

## How to add a new wallet UI component

Place it in `components/wallet/`. Follow the style of `TrustlineManager` and `WalletHealthCard`:

```tsx
"use client";

import React from "react";
// Lucide icons only — no other icon libraries
import { SomeIcon } from "lucide-react";
import { useMyFeature } from "@/app/hooks/useMyFeature";

interface MyComponentProps {
  publicKey: string;
  onDone?: () => void;
}

export default function MyComponent({ publicKey, onDone }: MyComponentProps) {
  const { status, isLoading, error, doSomething } = useMyFeature({ onSuccess: onDone });

  return (
    <div className="bg-surface border border-border rounded-[24px] p-6">
      {/* Always include role="alert" on error messages */}
      {error && (
        <div role="alert" aria-live="assertive" className="...">
          {error.message}
        </div>
      )}
      {/* ... */}
    </div>
  );
}
```

Accessibility requirements:
- Error messages must have `role="alert"` and `aria-live="assertive"`.
- Success messages must have `role="status"` and `aria-live="polite"`.
- All icon-only buttons need `aria-label`.
- Decorative icons need `aria-hidden="true"`.
- Form inputs need associated `<label>` elements with `htmlFor`.

---

## Signing modes

The codebase supports two signing paths. Your hook or function must handle both.

### Embedded wallet (Web2 flow)

The user's secret key is stored in `WalletProvider` state (loaded from `secureStorage`). Sign locally:

```ts
import * as StellarSdk from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/app/lib/stellar";

// secretKey comes from WalletProvider context — never from user input
const keypair = StellarSdk.Keypair.fromSecret(secretKey);
const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
tx.sign(keypair);
const signedXdr = tx.toEnvelope().toXDR("base64");
```

### Freighter (browser extension)

When no `secretKey` is available, delegate signing to the Freighter extension:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const freighter = (window as any).freighter;
if (!freighter) {
  throw { code: "FREIGHTER_NOT_INSTALLED", message: "..." };
}

const freighterNetwork = STELLAR_NETWORK === "mainnet" ? "PUBLIC" : "TESTNET";
const signedXdr = await freighter.signTransaction(xdr, {
  network: freighterNetwork,
  accountToSign: publicKey,
});
```

The `(window as any).freighter` cast with the eslint-disable comment is the established pattern — do not add a global type declaration for it.

### Choosing the right path

```ts
if (secretKey) {
  // embedded wallet path
} else {
  // Freighter path
}
```

Never prompt the user to enter a secret key in a form. The only place secret keys are accepted from user input is the import flow in `app/settings/page.tsx`.

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
} from "@/app/lib/networkConfig";
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

Every wallet action that succeeds must fire an analytics event. Use the methods on the `analytics` singleton from `@/lib/analytics`:

| Action | Method |
|--------|--------|
| Wallet connected | `analytics.trackWalletConnect(walletType)` |
| Wallet disconnected | `analytics.trackWalletDisconnect(walletType)` |
| New embedded wallet created | `analytics.trackWalletCreated(walletType)` |
| Secret key imported | `analytics.trackWalletImport(walletType)` |
| Testnet Friendbot funding | `analytics.trackWalletFunded(walletType)` |
| XLM or asset payment sent | `analytics.trackTransaction({ walletType, assetCode, amountBucket, network })` |
| Trustline added or removed | `analytics.trackTrustlineChange({ action, assetCode, walletType, network })` |
| Custom event | `analytics.trackEvent("event_name", { ...properties })` |

For payments, bucket the amount to avoid storing precise financial data:

```ts
import { bucketAmount } from "@/lib/analytics";

analytics.trackTransaction({
  walletType: "stellar_embedded",
  assetCode: "XLM",
  amountBucket: bucketAmount(parseFloat(amount)), // e.g. "1-10"
  network: STELLAR_NETWORK,
});
```

`bucketAmount` maps a number to one of: `"0"`, `"0-1"`, `"1-10"`, `"10-100"`, `"100-1000"`, `"1000+"`.

Analytics events are only sent when the user has granted analytics consent. The `analytics` singleton handles this automatically — you do not need to check consent yourself.

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

**Error tracking:** Use `captureWalletError` and `logWalletOperation` from `@/app/lib/walletErrorTracking.ts` for all wallet errors. These sanitize PII before sending to Sentry.

```ts
import { captureWalletError, logWalletOperation } from "@/app/lib/walletErrorTracking";

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

Before submitting a PR for any wallet feature, verify all of the following manually on testnet:

**Embedded wallet (Web2 flow)**
- [ ] Action works when a secret key is present in `WalletProvider` state
- [ ] Action fails gracefully when the account is not funded (404 from Horizon)
- [ ] Error message is shown in the UI — no raw error objects leaked

**Freighter flow**
- [ ] Action works when Freighter is installed and connected
- [ ] Correct error shown when Freighter is not installed
- [ ] User rejection (clicking "Decline" in Freighter) shows a friendly message, not a stack trace

**Network**
- [ ] Works on testnet (`NEXT_PUBLIC_STELLAR_NETWORK=testnet`)
- [ ] No hardcoded testnet URLs — switching to mainnet config changes the target

**Analytics**
- [ ] Relevant `analytics.track*` call fires on success (check browser console in dev mode for `[Analytics] Event:` logs)
- [ ] No wallet addresses or secret keys appear in the analytics payload

**Accessibility**
- [ ] Error states have `role="alert"`
- [ ] Loading states communicate progress (spinner with `aria-label`, or status text)
- [ ] All interactive elements are keyboard-reachable

**Code**
- [ ] No direct `@stellar/stellar-sdk` imports in component files
- [ ] No hardcoded network strings or Horizon URLs
- [ ] `reset()` is exported from any new hook
- [ ] New operation types added to `validateOperations` and `toSdkOperation`

---

## Common mistakes

**Hardcoding the network passphrase**

```ts
// ✗ wrong
networkPassphrase: "Test SDF Network ; September 2015"

// ✓ correct
import { NETWORK_PASSPHRASE } from "@/app/lib/stellar";
networkPassphrase: NETWORK_PASSPHRASE
```

**Importing the Stellar SDK in a component**

```ts
// ✗ wrong — in a .tsx file
import * as StellarSdk from "@stellar/stellar-sdk";

// ✓ correct — use a hook or lib function instead
import { buildBatchTransaction } from "@/app/lib/stellar";
```

**Forgetting to handle the unfunded account case**

Horizon returns HTTP 404 for accounts that have never received XLM. This is not an error — it means the account exists as a keypair but is not yet activated on-chain. Handle it explicitly:

```ts
if (response.status === 404) {
  // Account not funded yet — show "Fund your account" UI, not an error
}
```

**Using floating-point numbers for amounts**

```ts
// ✗ wrong
amount: 10.5

// ✓ correct
amount: "10.5"
```

**Memo text over 28 bytes**

```ts
// ✗ wrong — may throw if assetCode is long
memo: `Add ${assetCode} trustline`

// ✓ correct
memo: `Add ${assetCode}`.slice(0, 28)
```

**Not cleaning up polling intervals**

```ts
// ✓ correct pattern from useWalletHealth.ts
useEffect(() => {
  isMountedRef.current = true;
  runCheck();
  const timer = setInterval(runCheck, intervalMs);
  return () => {
    isMountedRef.current = false;  // prevent setState after unmount
    clearInterval(timer);
  };
}, [runCheck, intervalMs]);
```

---

## Further reading

- [Stellar Developer Docs](https://developers.stellar.org/)
- [Horizon API Reference](https://developers.stellar.org/api/horizon)
- [Freighter Wallet Docs](https://docs.freighter.app/)
- [`useWalletConnection` README](app/hooks/useWalletConnection.README.md)
- [`useStellarTransaction` README](app/hooks/useStellarTransaction.README.md)
- [Analytics guide](ANALYTICS.md)
