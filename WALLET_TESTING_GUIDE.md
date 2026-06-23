# Contributor Wallet Testing Guide

This guide covers everything you need to test wallet features locally in the ClipCash frontend. It is aimed at first-time contributors and assumes basic familiarity with React and TypeScript.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Wallet Architecture](#wallet-architecture)
5. [Running the Tests](#running-the-tests)
6. [Writing New Tests](#writing-new-tests)
7. [Mocking Freighter](#mocking-freighter)
8. [Mocking the Horizon API](#mocking-the-horizon-api)
9. [Testing Each Hook](#testing-each-hook)
10. [Testing Batch Transactions](#testing-batch-transactions)
11. [Manual Testing with Freighter](#manual-testing-with-freighter)
12. [Testnet Funding via Friendbot](#testnet-funding-via-friendbot)
13. [Common Errors and Fixes](#common-errors-and-fixes)
14. [Coverage](#coverage)

---

## Overview

The wallet system has three layers:

| Layer | Files | Responsibility |
|---|---|---|
| **Hooks** | `app/hooks/use*.ts` | React state, lifecycle, UI integration |
| **Lib** | `app/lib/stellar*.ts`, `app/lib/wallet*.ts` | Stellar SDK, storage, operations |
| **Config** | `app/lib/networkConfig.ts` | Network URLs, passphrases, env vars |

All tests run in a jsdom environment with Jest. Freighter and the Horizon API are always mocked — no real network calls are made during unit tests.

---

## Prerequisites

- Node.js 18+
- npm (comes with Node)
- Git

Optional for manual browser testing:
- Chrome or Firefox
- [Freighter browser extension](https://www.freighter.app/)

---

## Environment Setup

### 1. Install dependencies

```bash
cd clips-frontend
npm install
```

### 2. Create your local env file

```bash
cp ../.env.example .env.local
```

The defaults work for local development and testing:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org
NEXT_PUBLIC_API_URL=http://localhost:3000
```

`NEXT_PUBLIC_STELLAR_NETWORK` is the only variable that affects wallet behaviour. Leave it as `testnet` unless you are specifically testing mainnet guards.

### 3. Verify the setup

```bash
npm test -- --passWithNoTests
```

You should see Jest start up without errors.

---

## Wallet Architecture

### Wallet types

| Type | Hook / File | Description |
|---|---|---|
| **Freighter** | `useWalletConnection.ts` | Browser extension, primary self-custody wallet |
| **Embedded** | `embeddedWallet.ts` | Auto-created on email signup, no extension needed |
| **Passkey** | `usePasskeyWallet.ts` | WebAuthn-based PoC, not yet production-ready |
| **Multi-wallet** | `useMultiWalletConnection.ts` | Manages multiple wallets per user |

### Key files

```
app/
├── hooks/
│   ├── useWalletConnection.ts      # Freighter connect/disconnect
│   ├── useStellarTransaction.ts    # Build, sign, submit transactions + batch queue
│   ├── useBalance.ts               # XLM + asset balance with auto-refresh
│   ├── useMultiWalletConnection.ts # Multi-wallet management
│   ├── usePasskeyWallet.ts         # WebAuthn passkey wallet
│   └── useAutoStellarWallet.ts     # Auto-loads wallet from auth context
└── lib/
    ├── stellar.ts                  # Stellar SDK wrappers + buildBatchTransaction
    ├── stellarTransaction.ts       # Sequence number management, retry logic
    ├── stellarOperations.ts        # Typed operation descriptors (payment, trustline, etc.)
    ├── networkConfig.ts            # Horizon URLs, passphrases, env-driven config
    ├── embeddedWallet.ts           # Keypair generation, Friendbot funding
    ├── walletStorage.ts            # localStorage persistence for embedded wallets
    └── multiWalletStorage.ts       # Multi-wallet storage with active wallet tracking
```

### Network configuration

All network values come from `networkConfig.ts`, driven by `NEXT_PUBLIC_STELLAR_NETWORK`:

| Setting | Testnet | Mainnet |
|---|---|---|
| Horizon URL | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| Soroban RPC | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| Freighter network ID | `TESTNET` | `PUBLIC` |
| Friendbot | Available | Not available |

---

## Running the Tests

### Run all wallet tests

```bash
npm test
```

### Run a specific test file

```bash
npm test useWalletConnection
npm test useStellarTransaction
npm test useBalance
```

### Run in watch mode (re-runs on file save)

```bash
npm test -- --watch
```

### Run with coverage report

```bash
npm test -- --coverage
```

Coverage output goes to `coverage/`. Open `coverage/lcov-report/index.html` in a browser for the full report.

### Run a single test by name

```bash
npm test useWalletConnection -- --testNamePattern="should connect successfully"
```

---

## Writing New Tests

### File naming

Place test files next to the source file they test:

```
app/hooks/useWalletConnection.ts
app/hooks/useWalletConnection.test.ts   ← test file here
```

### Test file skeleton

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWalletConnection } from "./useWalletConnection";

// 1. Set up the Freighter mock (see next section)
const mockFreighter = {
  isConnected: jest.fn(),
  getPublicKey: jest.fn(),
  getNetwork: jest.fn(),
};

describe("useWalletConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Mocking window.freighter
    window.freighter = mockFreighter;
    mockFreighter.isConnected.mockResolvedValue(false);
    mockFreighter.getPublicKey.mockResolvedValue("GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
  });

  afterEach(() => {
    // @ts-expect-error - Cleaning up mock
    delete window.freighter;
  });

  it("should initialize with disconnected state", () => {
    const { result } = renderHook(() => useWalletConnection());
    expect(result.current.status).toBe("disconnected");
  });
});
```

### Async state updates

Always wrap async hook calls in `act`:

```typescript
await act(async () => {
  await result.current.connect();
});
```

Use `waitFor` when you need to wait for state to settle after an async side effect:

```typescript
await waitFor(() => {
  expect(result.current.isConnected).toBe(true);
});
```

---

## Mocking Freighter

Freighter is a browser extension that injects `window.freighter`. In tests, you replace it with a Jest mock object.

### Standard mock setup

```typescript
const mockFreighter = {
  isConnected: jest.fn(),
  getPublicKey: jest.fn(),
  getNetwork: jest.fn(),
  signTransaction: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // @ts-expect-error
  window.freighter = mockFreighter;

  // Default happy-path values
  mockFreighter.isConnected.mockResolvedValue(true);
  mockFreighter.getPublicKey.mockResolvedValue("GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
  mockFreighter.getNetwork.mockResolvedValue("TESTNET");
  mockFreighter.signTransaction.mockResolvedValue("signed_xdr_string");
});

afterEach(() => {
  // @ts-expect-error
  delete window.freighter;
});
```

### Simulating Freighter not installed

```typescript
it("should handle missing Freighter", async () => {
  // @ts-expect-error
  delete window.freighter;

  const { result } = renderHook(() => useWalletConnection());
  await act(async () => { await result.current.connect(); });

  expect(result.current.error?.code).toBe("FREIGHTER_NOT_INSTALLED");
});
```

### Simulating user rejection

```typescript
it("should handle user rejection", async () => {
  mockFreighter.getPublicKey.mockRejectedValue(
    new Error("User declined access")
  );

  const { result } = renderHook(() => useWalletConnection());
  await act(async () => { await result.current.connect(); });

  expect(result.current.error?.code).toBe("USER_REJECTED");
});
```

### Simulating a signing rejection

```typescript
it("should handle transaction rejection", async () => {
  mockFreighter.signTransaction.mockRejectedValue(
    new Error("User declined to sign the transaction")
  );

  const { result } = renderHook(() => useStellarTransaction());
  await act(async () => {
    await result.current.executeTransaction(async () => "unsigned_xdr");
  });

  expect(result.current.error?.code).toBe("USER_REJECTED");
});
```

### Simulating mainnet

```typescript
mockFreighter.getNetwork.mockResolvedValue("PUBLIC");
```

---

## Mocking the Horizon API

The Horizon REST API is called via `fetch`. Mock it globally:

```typescript
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});
```

### Successful account response

```typescript
(global.fetch as jest.Mock).mockResolvedValue({
  ok: true,
  json: async () => ({
    balances: [
      { asset_type: "native", balance: "1000.0000000" },
    ],
  }),
});
```

### Account not found (404)

```typescript
(global.fetch as jest.Mock).mockResolvedValue({
  ok: false,
  status: 404,
  statusText: "Not Found",
});
```

### Horizon transaction error

```typescript
(global.fetch as jest.Mock).mockResolvedValue({
  ok: false,
  json: async () => ({
    title: "Transaction Failed",
    extras: {
      result_codes: {
        transaction: "tx_insufficient_balance",
        operations: ["op_underfunded"],
      },
    },
  }),
});
```

### Sequence number conflict (tx_bad_seq)

```typescript
(global.fetch as jest.Mock)
  .mockResolvedValueOnce({
    ok: false,
    json: async () => ({
      extras: { result_codes: { transaction: "tx_bad_seq" } },
    }),
  })
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ hash: "abc123", ledger: 12345, successful: true }),
  });
```

### Simulating retry on network error

```typescript
(global.fetch as jest.Mock)
  .mockRejectedValueOnce(new Error("Network error"))
  .mockRejectedValueOnce(new Error("Network error"))
  .mockResolvedValueOnce({
    ok: true,
    json: async () => mockTransactionResult,
  });
```

---

## Testing Each Hook

### useWalletConnection

Tests live in `app/hooks/useWalletConnection.test.ts`.

Key scenarios to cover:

| Scenario | What to assert |
|---|---|
| Initial state | `status === "disconnected"`, all fields null |
| Successful connect | `status === "connected"`, `publicKey` set, `network` set |
| Freighter not installed | `error.code === "FREIGHTER_NOT_INSTALLED"` |
| User rejection | `error.code === "USER_REJECTED"` |
| Disconnect | `status === "disconnected"`, `publicKey === null` |
| Auto-reconnect on mount | `isConnected === true` when `isConnected()` returns true |
| Network detection | `network === "PUBLIC"` when Freighter returns `"PUBLIC"` |

```typescript
it("should auto-reconnect if previously connected", async () => {
  mockFreighter.isConnected.mockResolvedValue(true);

  const { result } = renderHook(() => useWalletConnection());

  await waitFor(() => {
    expect(result.current.isConnected).toBe(true);
  });
});
```

### useStellarTransaction

Tests live in `app/hooks/useStellarTransaction.test.ts`.

Key scenarios to cover:

| Scenario | What to assert |
|---|---|
| Initial state | `status === "idle"`, `queuedOperations` empty |
| Successful transaction | `status === "success"`, `transactionHash` set |
| Status progression | `building` → `signing` → `submitting` → `success` |
| User rejects signing | `error.code === "USER_REJECTED"` |
| Network error with retry | `fetch` called N times, eventually succeeds |
| Max retries exceeded | `status === "error"` after N failures |
| Horizon error code | `error.code === "tx_insufficient_balance"` |
| Cancel | `status === "idle"` after `cancel()` |
| Reset | All state back to initial values |

```typescript
it("should track status through all stages", async () => {
  const { result } = renderHook(() => useStellarTransaction());
  const buildTransaction = jest.fn().mockResolvedValue("xdr_string");

  await act(async () => {
    await result.current.executeTransaction(buildTransaction);
  });

  expect(result.current.status).toBe("success");
  expect(result.current.transactionHash).toBe("abc123");
});
```

### useBalance

Tests live in `app/hooks/useBalance.test.ts`.

Key scenarios to cover:

| Scenario | What to assert |
|---|---|
| No public key | `balance === null`, no fetch called |
| Successful fetch | `balance.xlm` set, `balance.usd` calculated |
| Account not found | `error.code === "ACCOUNT_NOT_FOUND"` |
| CoinGecko failure | Falls back to hardcoded price (`0.12`) |
| Manual refresh | `lastFetchTime` updates after `refresh()` |
| Auto-refresh | `fetch` called again after interval elapses |
| Unmount cleanup | No more fetches after component unmounts |
| Public key removed | `balance` resets to null |

```typescript
it("should auto-refresh at the specified interval", async () => {
  jest.useFakeTimers();

  const { result } = renderHook(() =>
    useBalance({ publicKey: "GTEST123", network: "TESTNET", refreshInterval: 5000 })
  );

  await waitFor(() => expect(result.current.balance).not.toBeNull());

  const callsBefore = (global.fetch as jest.Mock).mock.calls.length;

  act(() => { jest.advanceTimersByTime(5000); });

  await waitFor(() => {
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  jest.useRealTimers();
});
```

---

## Testing Batch Transactions

Batch transaction support was added in issue #391. The `useStellarTransaction` hook exposes a queue-based API for building multi-operation transactions.

### Operation builders

Import from `app/lib/stellarOperations.ts`:

```typescript
import {
  createPaymentOp,
  createChangeTrustOp,
  createManageSellOfferOp,
  createAccountMergeOp,
  createSetOptionsOp,
  trustlineAndPayment,   // preset: change_trust + payment
} from "@/app/lib/stellarOperations";
```

### Batch hook API

```typescript
const {
  queuedOperations,        // StellarOperation[] currently in the queue
  addOperation,            // (op, label?) => void — validates immediately
  removeOperation,         // (index) => void
  clearOperations,         // () => void
  executeBatchTransaction, // (buildBatch) => Promise<result | null>
} = useStellarTransaction({ network: "testnet" });
```

### Testing the queue

```typescript
it("should queue and execute a trustline + payment batch", async () => {
  const { result } = renderHook(() => useStellarTransaction());

  // Add operations
  act(() => {
    result.current.addOperation(
      createChangeTrustOp({ assetCode: "USDC", assetIssuer: "GISSUER123" }),
      "Add USDC trustline"
    );
    result.current.addOperation(
      createPaymentOp({
        destination: "GDEST123",
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GISSUER123",
      }),
      "Pay 100 USDC"
    );
  });

  expect(result.current.queuedOperations).toHaveLength(2);

  // Execute — the builder receives the queued ops and returns XDR
  const buildBatch = jest.fn().mockResolvedValue("batch_xdr");

  await act(async () => {
    await result.current.executeBatchTransaction(buildBatch);
  });

  expect(buildBatch).toHaveBeenCalledWith([
    expect.objectContaining({ type: "change_trust" }),
    expect.objectContaining({ type: "payment" }),
  ]);
  expect(result.current.status).toBe("success");
  // Queue is cleared on success
  expect(result.current.queuedOperations).toHaveLength(0);
});
```

### Testing validation errors

```typescript
it("should reject a payment with a missing destination", () => {
  const { result } = renderHook(() => useStellarTransaction());

  expect(() => {
    act(() => {
      result.current.addOperation(
        // @ts-expect-error — intentionally invalid
        createPaymentOp({ amount: "10" })
      );
    });
  }).toThrow();
});
```

### Testing empty batch guard

```typescript
it("should error when executing an empty batch", async () => {
  const { result } = renderHook(() => useStellarTransaction());
  const buildBatch = jest.fn();

  await act(async () => {
    await result.current.executeBatchTransaction(buildBatch);
  });

  expect(result.current.error?.code).toBe("EMPTY_BATCH");
  expect(buildBatch).not.toHaveBeenCalled();
});
```

### Queue preservation on error

On a failed batch, the queue is preserved so the user can retry without re-adding operations:

```typescript
it("should preserve the queue on submission failure", async () => {
  const { result } = renderHook(() => useStellarTransaction());

  act(() => {
    result.current.addOperation(createPaymentOp({ destination: "GDEST", amount: "5" }));
  });

  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: async () => ({ extras: { result_codes: { transaction: "tx_failed" } } }),
  });

  await act(async () => {
    await result.current.executeBatchTransaction(
      jest.fn().mockResolvedValue("failing_xdr")
    );
  });

  expect(result.current.status).toBe("error");
  expect(result.current.queuedOperations).toHaveLength(1); // still there for retry
});
```

### Using the preset helpers

```typescript
import { trustlineAndPayment } from "@/app/lib/stellarOperations";

it("should use the trustlineAndPayment preset", async () => {
  const { result } = renderHook(() => useStellarTransaction());

  const [trustOp, payOp] = trustlineAndPayment({
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    destination: "GDEST123",
    amount: "50",
  });

  act(() => {
    result.current.addOperation(trustOp, "Add USDC trustline");
    result.current.addOperation(payOp, "Receive 50 USDC");
  });

  expect(result.current.queuedOperations).toHaveLength(2);
});
```

---

## Manual Testing with Freighter

For end-to-end testing in the browser you need the Freighter extension and a funded testnet account.

### Setup

1. Install [Freighter](https://www.freighter.app/) in Chrome or Firefox.
2. Open Freighter and create or import a wallet.
3. Switch Freighter to **Testnet**: Settings → Network → Testnet.
4. Start the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000` in the browser with Freighter installed.

### Wallet connection flow

1. Navigate to any page with a "Connect Wallet" button.
2. Click it — Freighter will prompt for permission.
3. Approve the connection.
4. The UI should show your truncated public key (e.g. `GABCD...WXYZ`).

### Sending a test payment

1. Connect your wallet.
2. Navigate to the payment or vault page.
3. Enter a destination testnet address and an amount.
4. Click Send — Freighter will show a signing prompt.
5. Approve — the transaction is submitted to testnet Horizon.
6. Check the result on [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet).

### Batch transaction flow

1. Connect your wallet.
2. Queue multiple operations via the UI (e.g. add a trustline then send a payment).
3. Click the batch submit button.
4. Freighter shows a single signing prompt covering all operations.
5. Approve — all operations are submitted atomically.

---

## Testnet Funding via Friendbot

New testnet accounts start with zero balance. Fund them for free using Friendbot.

### Via the app

The embedded wallet flow calls Friendbot automatically on account creation. No action needed.

### Via curl

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### Via the Stellar Laboratory

Open [https://laboratory.stellar.org](https://laboratory.stellar.org), go to **Account Creator**, paste your public key, and click **Get test network lumens**.

### Via the `fundWithFriendbot` utility

```typescript
import { fundWithFriendbot } from "@/app/lib/stellar";

await fundWithFriendbot("GYOUR_PUBLIC_KEY");
```

This funds the account with 10,000 XLM on testnet. It throws if called on mainnet.

---

## Common Errors and Fixes

### `FREIGHTER_NOT_INSTALLED`

**Cause:** `window.freighter` is undefined.

In tests: make sure `window.freighter = mockFreighter` is set in `beforeEach` and cleaned up in `afterEach`.

In the browser: install the Freighter extension and refresh the page.

---

### `USER_REJECTED`

**Cause:** The user (or mock) declined the connection or signing prompt.

In tests: mock the rejection explicitly to verify your error handling:

```typescript
mockFreighter.signTransaction.mockRejectedValue(
  new Error("User declined to sign the transaction")
);
```

In the browser: click **Approve** in the Freighter popup.

---

### `tx_bad_seq`

**Cause:** The account's sequence number changed between when the transaction was built and when it was submitted (e.g. another transaction landed first).

The `submitStellarTransaction` function retries automatically up to 3 times by re-fetching the sequence number. If you see this in tests, simulate it with:

```typescript
(global.fetch as jest.Mock)
  .mockResolvedValueOnce({
    ok: false,
    json: async () => ({ extras: { result_codes: { transaction: "tx_bad_seq" } } }),
  })
  .mockResolvedValueOnce({ ok: true, json: async () => ({ sequence: "12345" }) }) // re-fetch
  .mockResolvedValueOnce({ ok: true, json: async () => mockSuccessResult });
```

---

### `ACCOUNT_NOT_FOUND` (balance fetch)

**Cause:** The account has never been funded and does not exist on the ledger.

In tests: return a 404 from the Horizon mock:

```typescript
(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
```

In the browser: fund the account via Friendbot (see above).

---

### `EMPTY_BATCH`

**Cause:** `executeBatchTransaction` was called with no operations in the queue.

Fix: call `addOperation` at least once before `executeBatchTransaction`.

---

### `BATCH_VALIDATION_ERROR`

**Cause:** One of the queued operations failed validation (e.g. missing `destination` on a payment, or missing `assetIssuer` on a trustline).

Fix: check the error message — it includes the operation index and the specific field that failed.

---

### `localStorage` unavailable in tests

**Cause:** `walletStorage.ts` uses `localStorage`, which is available in jsdom but may throw in some configurations.

Fix: the `isStorageAvailable()` guard in `walletStorage.ts` handles this gracefully. If you need to test storage-unavailable scenarios, mock `localStorage`:

```typescript
jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
  throw new DOMException("QuotaExceededError");
});
```

---

### Timer-related test failures

`useBalance` uses `setInterval` for auto-refresh. If tests are leaking timers, use fake timers:

```typescript
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

// Advance time manually
act(() => { jest.advanceTimersByTime(30000); });
```

---

## Coverage

To see which wallet code paths are not yet tested:

```bash
npm test -- --coverage --collectCoverageFrom="app/hooks/use*.ts" --collectCoverageFrom="app/lib/stellar*.ts" --collectCoverageFrom="app/lib/wallet*.ts"
```

The project targets the following wallet files for coverage:

- `app/hooks/useWalletConnection.ts`
- `app/hooks/useStellarTransaction.ts`
- `app/hooks/useBalance.ts`
- `app/lib/stellar.ts`
- `app/lib/stellarTransaction.ts`
- `app/lib/stellarOperations.ts`
- `app/lib/embeddedWallet.ts`
- `app/lib/walletStorage.ts`

When adding a new wallet feature, add tests for:

1. The happy path (success)
2. Each distinct error code the feature can produce
3. Any retry or backoff logic
4. Cleanup on unmount (intervals, abort controllers)

---

## Further Reading

- [`useWalletConnection` API reference](app/hooks/useWalletConnection.README.md)
- [`useStellarTransaction` API reference](app/hooks/useStellarTransaction.README.md)
- [Stellar integration overview](STELLAR.md)
- [Balance fetching implementation](BALANCE_FETCHING_IMPLEMENTATION.md)
- [Stellar developer docs](https://developers.stellar.org/)
- [Freighter docs](https://docs.freighter.app/)
- [Horizon API reference](https://developers.stellar.org/api/horizon)
- [Stellar Laboratory (testnet explorer)](https://laboratory.stellar.org)
- [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet)
