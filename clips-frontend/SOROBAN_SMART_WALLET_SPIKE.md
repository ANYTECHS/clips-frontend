# Spike: Soroban Contract-Based Smart Wallets with Passkeys

**Issue:** #376  
**Type:** Technical Spike  
**Status:** Draft  
**Date:** 2026-05-28  
**Author:** Engineering Team

---

## Goal

Evaluate the feasibility of replacing (or augmenting) the current browser-extension wallet flow with a **Soroban smart contract wallet** that uses **WebAuthn passkeys** as the authentication primitive. Users would sign Stellar transactions with Face ID / Touch ID / hardware security keys — no seed phrase, no extension required.

---

## Background

ClipCash currently supports Stellar via `StellarWalletProvider`, which delegates to `StellarWalletsKit` (Freighter, Lobstr, xBull, WalletConnect, Ledger). This requires users to install a browser extension or use a hardware wallet — a significant onboarding barrier for Web2 users.

Soroban (Stellar's smart contract platform) enables **account abstraction**: a smart contract can own a Stellar account and define arbitrary authentication logic. Combined with the **WebAuthn / FIDO2 standard** (passkeys), we can authenticate users with biometrics or platform authenticators instead of private keys.

---

## How It Works

```
User (biometric / PIN)
        │
        ▼
  WebAuthn Credential
  (P-256 key pair, stored in device secure enclave)
        │
        ▼
  Soroban Smart Wallet Contract
  ┌─────────────────────────────────────────────┐
  │  - Stores authorized passkey public keys    │
  │  - Verifies secp256r1 (P-256) signatures    │
  │  - Executes arbitrary Stellar operations    │
  │  - Supports social recovery signers         │
  └─────────────────────────────────────────────┘
        │
        ▼
  Stellar Network (Testnet / Mainnet)
```

### Key Insight

WebAuthn uses **P-256 (secp256r1)** signatures. Stellar natively uses **Ed25519**. The bridge is a Soroban contract that:
1. Stores the user's P-256 public key on-chain.
2. Receives a WebAuthn assertion (signature + authenticator data).
3. Verifies the P-256 signature using Soroban's `crypto` host functions.
4. If valid, executes the requested Stellar operations on behalf of the contract account.

---

## Required Contracts

### 1. `smart-wallet` (Core)

The primary contract. Deployed once per user.

```rust
// Simplified interface
pub trait SmartWalletTrait {
    // Register a new passkey credential
    fn add_passkey(env: Env, credential_id: Bytes, public_key: Bytes);

    // Remove a passkey (requires existing passkey signature)
    fn remove_passkey(env: Env, credential_id: Bytes, auth: WebAuthnAuth);

    // Execute one or more Stellar operations
    fn execute(env: Env, ops: Vec<Operation>, auth: WebAuthnAuth);

    // Add a social recovery signer (Stellar keypair)
    fn add_recovery_signer(env: Env, signer: Address, auth: WebAuthnAuth);
}

pub struct WebAuthnAuth {
    pub credential_id: Bytes,
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    pub signature: Bytes, // DER-encoded P-256 signature
}
```

**Storage layout:**
- `DataKey::Passkeys` → `Map<Bytes, Bytes>` (credential_id → public_key)
- `DataKey::RecoverySigners` → `Vec<Address>`
- `DataKey::Nonce` → `u64` (replay protection)

### 2. `factory` (Deployment)

Deploys new `smart-wallet` instances deterministically (CREATE2-style via `deploy_v2`).

```rust
pub trait FactoryTrait {
    // Deploy a new smart wallet for a given passkey
    fn deploy(
        env: Env,
        credential_id: Bytes,
        public_key: Bytes,
    ) -> Address; // returns the new contract address
}
```

The factory uses `env.deployer().with_address(salt)` where `salt = sha256(credential_id)`, making the wallet address **deterministic and recoverable** from the credential ID alone.

### 3. `secp256r1-verifier` (Crypto Helper)

A shared library contract (or inline module) that verifies P-256 signatures. Soroban exposes `env.crypto().secp256r1_verify()` as a host function — this contract wraps it with proper input validation.

```rust
pub fn verify_p256(
    env: &Env,
    public_key: &Bytes,   // 65-byte uncompressed P-256 point
    message_hash: &Bytes, // SHA-256 of (authenticator_data || SHA-256(client_data_json))
    signature: &Bytes,    // DER-encoded signature
) -> bool
```

---

## Frontend Changes Required

### New Files

| File | Purpose |
|------|---------|
| `components/PasskeyWalletProvider.tsx` | React context for passkey wallet state |
| `hooks/usePasskeyWallet.ts` | Hook exposing `register`, `authenticate`, `execute` |
| `lib/webauthn.ts` | WebAuthn credential creation and assertion helpers |
| `lib/soroban-wallet.ts` | Soroban contract invocation helpers |
| `components/PasskeySetup.tsx` | UI: register a new passkey wallet |
| `components/PasskeySignIn.tsx` | UI: sign in with existing passkey |

### Modified Files

| File | Change |
|------|--------|
| `app/layout.tsx` | Add `PasskeyWalletProvider` alongside existing providers |
| `components/StellarWalletProvider.tsx` | Expose passkey wallet address when active |
| `components/WalletConnectButton.tsx` | Add "Use Passkey" option in wallet picker |
| `app/onboarding/page.tsx` | Offer passkey wallet creation during onboarding |

### `lib/webauthn.ts` — Key Functions

```typescript
// Create a new passkey credential (registration)
export async function createPasskeyCredential(username: string): Promise<{
  credentialId: Uint8Array;
  publicKey: Uint8Array; // uncompressed P-256 point (65 bytes)
}>;

// Get an assertion for signing a transaction
export async function getPasskeyAssertion(
  credentialId: Uint8Array,
  challenge: Uint8Array // SHA-256 of the Soroban transaction XDR
): Promise<{
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signature: Uint8Array; // DER-encoded P-256 signature
}>;
```

### `lib/soroban-wallet.ts` — Key Functions

```typescript
// Deploy a new smart wallet via the factory contract
export async function deploySmartWallet(
  rpc: SorobanRpc.Server,
  credentialId: Uint8Array,
  publicKey: Uint8Array
): Promise<string>; // returns contract address

// Invoke smart wallet execute() with a WebAuthn assertion
export async function executeWithPasskey(
  rpc: SorobanRpc.Server,
  walletAddress: string,
  operations: xdr.Operation[],
  assertion: WebAuthnAssertion
): Promise<string>; // returns transaction hash
```

---

## Authentication Flow

### Registration (New User)

```
1. User clicks "Create Passkey Wallet"
2. Frontend calls navigator.credentials.create() with:
   - rp: { id: "clipcash.ai", name: "ClipCash" }
   - user: { id: uuid, name: email }
   - pubKeyCredParams: [{ alg: -7 }]  // ES256 = P-256
3. Device prompts biometric / PIN
4. Browser returns credential: { id, response.getPublicKey() }
5. Frontend calls factory.deploy(credential_id, public_key) via Soroban RPC
6. Factory deploys smart-wallet contract, returns address
7. Store { credentialId, walletAddress } in localStorage (non-sensitive)
```

### Transaction Signing

```
1. Build Soroban transaction XDR (unsigned)
2. Compute challenge = SHA-256(transaction_xdr)
3. Call navigator.credentials.get({ challenge, allowCredentials: [credentialId] })
4. Device prompts biometric / PIN
5. Browser returns assertion: { authenticatorData, clientDataJSON, signature }
6. Call smart_wallet.execute(operations, WebAuthnAuth { ... assertion ... })
7. Soroban contract verifies P-256 signature on-chain
8. If valid, operations execute on Stellar network
```

---

## Environment Variables

```env
# Factory contract address (deployed once per network)
NEXT_PUBLIC_SMART_WALLET_FACTORY=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Soroban RPC (already exists)
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

---

## Dependencies

```json
{
  "@stellar/stellar-sdk": "^15.1.0",  // already installed
  "@simplewebauthn/browser": "^10.0.0",  // WebAuthn client helpers
  "@simplewebauthn/server": "^10.0.0"   // optional: server-side verification
}
```

`@simplewebauthn/browser` wraps the raw WebAuthn API with better error messages and cross-browser compatibility. It is MIT-licensed and actively maintained.

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Replay attacks | Nonce stored in contract storage, incremented on each `execute` call |
| Credential phishing | WebAuthn origin binding — credential only works on `clipcash.ai` |
| Lost device | Social recovery signers (Stellar keypairs) can rotate passkeys |
| Contract bugs | Audit required before mainnet; use testnet initially |
| P-256 verification cost | Soroban `secp256r1_verify` is a host function — cheap (~0.5 XLM per tx) |
| Key extraction | P-256 private key lives in device secure enclave, never exported |

---

## Limitations & Open Questions

1. **Browser support:** WebAuthn is supported in all modern browsers, but `authenticatorAttachment: "platform"` (biometrics) requires a compatible device. Fallback to roaming authenticators (YubiKey) is possible.

2. **Mobile:** React Native / Expo support for WebAuthn requires `expo-passkeys` or a custom native module. Out of scope for this spike.

3. **Gas / fees:** Who pays the Soroban fee for the first transaction? Options:
   - Fee sponsorship via a ClipCash server-side account (simplest for UX).
   - User funds the contract account with a small XLM amount during registration.

4. **Factory contract deployment:** The factory must be deployed and maintained by ClipCash. Address must be hardcoded per network.

5. **Existing users:** Migration path for users already using Freighter/Lobstr is not defined. Both wallet types can coexist.

6. **`secp256r1_verify` availability:** Confirm the host function is available on the target Soroban protocol version (Protocol 21+).

---

## Proof-of-Concept Plan

| Step | Task | Effort |
|------|------|--------|
| 1 | Deploy `smart-wallet` + `factory` contracts to Testnet | 2 days |
| 2 | Implement `lib/webauthn.ts` registration + assertion | 1 day |
| 3 | Implement `lib/soroban-wallet.ts` deploy + execute | 1 day |
| 4 | Build `PasskeySetup.tsx` and `PasskeySignIn.tsx` UI | 1 day |
| 5 | Wire into `WalletConnectButton` as an option | 0.5 day |
| 6 | End-to-end test: register → mint NFT → verify on-chain | 1 day |

**Total estimate:** ~6.5 days for a working testnet PoC.

---

## References

- [Stellar Soroban Docs](https://developers.stellar.org/docs/build/smart-contracts)
- [Soroban `secp256r1_verify` host function](https://docs.rs/soroban-sdk/latest/soroban_sdk/crypto/struct.Crypto.html)
- [WebAuthn Spec (W3C)](https://www.w3.org/TR/webauthn-3/)
- [SimpleWebAuthn](https://simplewebauthn.dev/)
- [Passkey Smart Wallet (Stellar Community)](https://github.com/kalepail/passkey-kit)
- [Soroban Account Abstraction Examples](https://github.com/stellar/soroban-examples)
- [Protocol 21 Release Notes](https://developers.stellar.org/docs/networks/stellar-disbursement-platform/admin-guide/stellar-disbursement-platform-release-notes)
