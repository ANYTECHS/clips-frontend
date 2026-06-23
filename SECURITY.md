# Security Model

## Social wallet recovery

Social recovery protects a Stellar wallet backup using:

1. **Password-based encryption (client-side)** — The mnemonic or secret key is encrypted with AES-GCM (PBKDF2-derived key) before any sharing. The recovery password is never sent to the server.

2. **Shamir secret sharing (t-of-n)** — The encrypted backup is split into `n` shares with threshold `t`. Each guardian receives one share by email invitation. No single guardian or the server stores the full encrypted backup.

3. **Guardian approval** — Recovery sessions require at least `t` guardians to approve before shares are combined. The combined ciphertext is returned only when the threshold is met.

4. **Final decryption** — The account owner supplies the recovery password locally to decrypt the restored ciphertext.

### Mock vs production

| Component | Current (mock API) | Production requirement |
| --- | --- | --- |
| Share storage | In-memory `guardianShares` map | Encrypted at rest; guardian-authenticated retrieval |
| Email invitations | `console.info` via `sendGuardianInvitation` | Transactional email (SES, SendGrid, etc.) with signed approval links |
| Guardian approval | Simulated in UI | Authenticated guardian endpoints + audit log |

## Error monitoring (Sentry)

Wallet and Stellar errors sent to Sentry use `beforeSend` and `beforeBreadcrumb` hooks with shared redaction in `app/lib/sentryRedaction.ts`. Secret keys, mnemonics, and similar fields are never included in events or breadcrumbs.

## Soroban smart contracts

`invoke_contract` operations are not supported in the Horizon batch builder. See `SOROBAN_SMART_WALLET_SPIKE.md` for the planned Soroban RPC integration.
