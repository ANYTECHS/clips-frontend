# Stellar Wallet Integration

## What was built

Full non-custodial Stellar wallet connection for ClipCash using **Stellar Wallets Kit v2** (`@creit-tech/stellar-wallets-kit`). Users can connect any of the popular Stellar wallets with a single modal — no separate code per wallet needed.

---

## How it works

```
User clicks "Connect Wallet"
        │
        ▼
WalletButton → useWallet() hook
        │
        ▼
StellarWalletsKit.authModal()    ← opens built-in wallet picker UI
        │
        ▼
User picks wallet (Freighter / xBull / Lobstr / Albedo / Rabet)
        │
        ▼
Wallet extension returns public key (G…)
        │
        ▼
WalletProvider stores address in state + localStorage
        │
        ▼
WalletButton updates to show truncated address
```

No private keys ever touch your code. The wallet extension handles everything.

---

## Files added / changed

| File | What it does |
|------|-------------|
| `lib/wallet.ts` | Singleton kit init + helper functions (connect, disconnect, getAddress) |
| `components/WalletProvider.tsx` | React context that exposes `address`, `connect`, `disconnect`, `openProfile` |
| `components/shared/WalletButton.tsx` | Drop-in button — shows connect/connecting/connected state automatically |
| `app/layout.tsx` | `<WalletProvider>` added to the provider tree |
| `components/AuthForm.tsx` | Old `alert()` stub replaced with `<WalletButton>` |
| `components/landing/URLForm.tsx` | Old `alert()` stub replaced with `<WalletButton>` |
| `components/platforms/PlatformsContent.tsx` | Web3 section replaced with live Stellar wallet card |
| `.env.local` | Added `NEXT_PUBLIC_STELLAR_NETWORK` |

---

## Supported wallets (out of the box)

| Wallet | Type | Where |
|--------|------|--------|
| **Freighter** | Browser extension | [freighter.app](https://www.freighter.app) |
| **Lobstr** | Mobile + web | [lobstr.co](https://lobstr.co) |
| **Albedo** | Web-based (no install) | [albedo.link](https://albedo.link) |
| **Rabet** | Browser extension | [rabet.io](https://rabet.io) |

> **xBull is intentionally excluded.** The `xBullModule` depends on `@creit.tech/xbull-wallet-connect` which pulls in `rxjs` v7 using a broken ESM bundle that can't resolve `tslib` in Next.js. xBull users can still connect via Freighter or Lobstr on mobile.

To add more (Ledger, WalletConnect, Hana, Klever, etc.) just add the module in `lib/wallet.ts`:

```ts
import { LedgerModule } from "@creit-tech/stellar-wallets-kit/modules/ledger";

StellarWalletsKit.init({
  modules: [
    new FreighterModule(),
    new LedgerModule(),   // ← add here
    // ...
  ],
});
```

---

## Usage

### 1. Drop in the button anywhere

```tsx
import WalletButton from "@/components/shared/WalletButton";

// Full button (shows label)
<WalletButton />

// Compact icon-only button
<WalletButton compact />

// Custom styling
<WalletButton className="your-tailwind-classes" />
```

### 2. Read the wallet address in any component

```tsx
import { useWallet } from "@/components/WalletProvider";

export function MyComponent() {
  const { address, connect, disconnect } = useWallet();

  return address
    ? <p>Connected: {address}</p>
    : <button onClick={connect}>Connect</button>;
}
```

### 3. Open the profile modal (shows address, copy, disconnect)

```tsx
const { openProfile } = useWallet();
<button onClick={openProfile}>My Wallet</button>
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | `testnet` | Set to `mainnet` for production |

Add to `.env.local` (already done) and your production environment (Vercel, etc.).

---

## Switching networks — the Testnet → Mainnet migration path

Users can move between Testnet and Mainnet **without creating a new wallet**.
A Stellar keypair works on both networks: the secret key lives in the user's
wallet extension (non-custodial), and the same public key (`G…`) is reused on
either ledger. Only the network passphrase and Horizon endpoint differ.

### Option A — in-app network toggle (recommended for users)

The Platforms page (`/platforms`, *Web3 Wallets* section) renders a
`<NetworkToggle />` that switches the active network with a confirmation modal.

What happens when a user confirms the switch:

1. The chosen network is written to `localStorage` (`clipcash_stellar_network`).
2. `clipcash_wallet_address` is **left untouched** — the connected public key
   is preserved, and the wallet extension still holds the keys. No new wallet,
   no re-connect, no re-link to the backend account.
3. The page reloads. On reload `lib/wallet.ts` reads the stored network,
   re-initialises `StellarWalletsKit` on the new network, and restores the
   connected address.

> The kit binds to a single network per page load, so a reload is required to
> re-init on the new network. This mirrors Stellar's own guidance that an
> existing instance should not switch networks in place — a fresh init is used.

### Option B — environment variable (deploy-time default)

Set the build-time default that the toggle falls back to when no user choice is
stored:

1. In `.env.local` (or Vercel env):
   ```
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
   ```
2. `lib/wallet.ts` reads this as the default network. A user can still override
   it at runtime with the toggle; their choice is persisted in `localStorage`
   and takes precedence over the env var.

### Before going to mainnet — checklist for users

A testnet account does **not** exist on mainnet (they are separate ledgers).
The keypair is the same, but the account must be created on each network:

1. **Switch the wallet extension** (Freighter / Lobstr / Albedo / Rabet) to
   **Mainnet / Public**. If the extension stays on Testnet while the app is on
   Mainnet, signing fails with `tx_bad_auth`.
2. **Fund the mainnet account** with at least 2 XLM (the Stellar minimum
   reserve). Testnet balances do not carry over.
3. **Add a USDC trustline** on mainnet if the app uses USDC payments/tips.
4. Use the in-app toggle to switch the app to Mainnet and confirm.

### Files

| File | What it does |
|------|-------------|
| `lib/wallet.ts` | `NetworkId`, `getCurrentNetwork`, `isMainnet`, `getStellarNetwork`, `setNetwork` — runtime-switchable, persisted network selection |
| `components/shared/NetworkToggle.tsx` | UI toggle + confirmation modal |
| `components/WalletProvider.tsx` | Exposes `network` and `switchNetwork()` via `useWallet()` |
| `components/platforms/PlatformsContent.tsx` | Renders `<NetworkToggle />` in the Web3 Wallets section |

> **Always test on testnet first.** You can get test XLM from [Friendbot](https://laboratory.stellar.org/#account-creator).

---

## What you should know

### Non-custodial by design
Your backend never sees the user's private key or secret. The wallet extension holds the keys. ClipCash only ever sees the **public key (G…)**.

### Address persistence and network changes
The address is stored in `localStorage` under the key `clipcash_wallet_address`. On reload, the UI restores immediately without re-prompting. The kit's `STATE_UPDATED` event keeps it in sync if the user switches accounts inside their wallet. While connected, the provider checks the active network periodically and when the page regains focus, then refreshes Horizon balances when the network changes. If the wallet is on a network other than the app's configured `NEXT_PUBLIC_STELLAR_NETWORK`, the address is cleared and a banner asks the user to switch networks and reconnect.

### No signing yet
This integration handles **connection only** — reading the public key so you can associate it with a user account, show their balance, route rewards to it, etc. If you later need to sign and submit transactions (e.g. payment, token mint):

```ts
import { StellarWalletsKit } from "@/lib/wallet";
import { TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from "@stellar/stellar-sdk";
import { Horizon } from "@stellar/stellar-sdk";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

async function sendPayment(destination: string, amount: string) {
  const { address } = await StellarWalletsKit.getAddress();
  const account = await server.loadAccount(address);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({
      destination,
      asset: Asset.native(),
      amount,
    }))
    .setTimeout(30)
    .build();

  // This sends the XDR to the wallet extension for the user to approve
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(tx.toXDR());

  // Submit the signed transaction
  await server.submitTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET)
  );
}
```

The user sees a confirmation screen in their wallet — your app never handles the secret.

---

## Risks and vulnerabilities

### Low risk (handled)
| Risk | How it's mitigated |
|------|--------------------|
| Secret key exposure | Non-custodial — keys stay in the wallet extension |
| Backend URL in client bundle | Using server-side proxy route (`/api/proxy`) |
| XSS stealing the public address | `localStorage` only stores the public key — it's not sensitive |

### Medium risk (be aware)
| Risk | What to do |
|------|-----------|
| **Wallet spoofing** | Always verify transaction contents in the wallet UI before approving. Never auto-sign. |
| **Address association leak** | Storing the Stellar address linked to an account ID on your backend creates a privacy trail. Add a privacy notice if relevant for your region. |
| **localStorage availability** | Falls back gracefully — connecting works fine in private/incognito mode, address just won't persist across tabs. |

### High risk (action required before mainnet)
| Risk | Action required |
|------|----------------|
| **No transaction verification on backend** | Before routing real XLM rewards to a stored address, verify it's a valid Stellar public key (`StrKey.isValidEd25519PublicKey(address)` from `@stellar/stellar-sdk`). |
| **No rate limiting on wallet link endpoint** | If your backend stores wallet addresses, protect that endpoint from spam. |
| **WalletConnect not included** | WalletConnect module pulls in a large SDK with its own peer/relay dependencies. Only add it if you genuinely need mobile wallet bridging — it significantly increases bundle size and introduces a relay server dependency. |

---

## Testing on testnet

1. Install [Freighter](https://www.freighter.app) browser extension
2. Switch it to **Testnet** mode
3. Go to [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator) and fund your testnet address
4. Click "Connect Wallet" in the app — Freighter will appear in the modal
5. Check [Stellar Expert (testnet)](https://testnet.stellar.expert) to inspect your account

---

## Adding wallet address to your backend

When a user connects, you can POST the address to your API:

```ts
const { address } = useWallet();

useEffect(() => {
  if (address && user) {
    apiClient.patch("/users/me", { stellarAddress: address })
      .catch(() => {}); // non-blocking
  }
}, [address, user]);
```

Make sure your backend validates `StrKey.isValidEd25519PublicKey(address)` before storing it.
