# Safari Passkey Wallet Notes

Safari supports WebAuthn passkeys only when the page is served from HTTPS or localhost and the device has iCloud Keychain, Touch ID, Face ID, or a security key available.

## Compatibility flow

- `app/lib/webauthnCompatibility.ts` detects Safari, iOS, secure-context support, and WebAuthn support.
- `usePasskeyWallet()` stops before registration/authentication when the browser cannot run WebAuthn and returns a fallback message.
- The passkey API omits credential `transports` for Safari and requests a platform authenticator during registration to avoid Safari descriptor incompatibilities.

## Fallback

If Safari cannot complete passkey registration or authentication, users should use a current Safari release on HTTPS with passkeys enabled, or use the existing Stellar secret-key import flow from Advanced Wallet Mode.
