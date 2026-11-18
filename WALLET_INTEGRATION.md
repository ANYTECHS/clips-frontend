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

## Switching to Mainnet

1. In `.env.local` (or Vercel env):
   ```
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
   ```
2. That's it — `lib/wallet.ts` reads this and passes `Networks.PUBLIC` to the kit.

> **Always test on testnet first.** You can get test XLM from [Friendbot](https://laboratory.stellar.org/#account-creator).

---

## What you should know

### Non-custodial by design
Your backend never sees the user's private key or secret. The wallet extension holds the keys. ClipCash only ever sees the **public key (G…)**.

### Address persistence
The address is stored in `localStorage` under the key `clipcash_wallet_address`. On reload, the UI restores immediately without re-prompting. The kit's `STATE_UPDATED` event keeps it in sync if the user switches accounts inside their wallet.

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
