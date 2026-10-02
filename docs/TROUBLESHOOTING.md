# Troubleshooting Guide

This guide covers common issues encountered by users and developers of the Clips Frontend application, diagnostic commands, error message resolutions, and a frequently asked questions (FAQ) reference.

---

## 1. Quick Diagnostic Checklist

If you encounter issues while running or using the application, run these standard diagnostic checks:

```bash
# Verify Node and Package Manager version (Node >= 18 recommended)
node -v
pnpm -v

# Check repository and package dependencies
pnpm install

# Check environment configuration
test -f .env.local && echo ".env.local exists" || echo "Missing .env.local (copy from .env.example)"

# Verify build and type health
pnpm type-check
pnpm lint

# Check local development server status
curl -I http://localhost:3000
```

---

## 2. Common Issues & Solutions

### 2.1 Wallet & Stellar Network Issues

#### Problem: Wallet extension is not detected (Freighter, Albedo, etc.)
- **Cause**: Browser extension is locked, disabled, or blocked by content scripts / browser permissions.
- **Resolution**:
  1. Open your browser extension manager and confirm the wallet extension is active.
  2. Unlock your wallet and refresh the page (`Ctrl+F5` or `Cmd+Shift+R`).
  3. Ensure third-party site permissions are allowed for `localhost` or the production domain.
  4. Refer to [WALLET_CONNECTION_IMPLEMENTATION.md](../WALLET_CONNECTION_IMPLEMENTATION.md) for supported wallet providers.

#### Problem: Transaction submission fails with `Horizon error` or `Timeout`
- **Cause**: Stellar Horizon RPC endpoint rate-limiting, temporary network congestion, or invalid sequence number.
- **Resolution**:
  1. Verify your network setting matches the target environment (Testnet vs. Public/Mainnet) in your wallet.
  2. Verify `NEXT_PUBLIC_STELLAR_NETWORK` and `NEXT_PUBLIC_HORIZON_URL` in `.env.local`.
  3. Check Stellar network status on [Stellar Dashboard](https://dashboard.stellar.org).

---

### 2.2 Authentication & Session Issues

#### Problem: Infinite redirect loop between `/login` and protected routes
- **Cause**: Stale cookies, desynchronized JWT tokens, or misconfigured route protection middleware.
- **Resolution**:
  1. Open Developer Tools > Application > Cookies, and clear all cookies for `localhost`.
  2. Check `ROUTE_PROTECTION_MIDDLEWARE.md` for role and route configuration.
  3. Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL` match your local deployment host.

#### Problem: Session expires unexpectedly during operations
- **Cause**: Token expiry mismatch or Redis session store unreachable.
- **Resolution**:
  1. Check Redis connectivity if using shared sessions: `redis-cli ping`.
  2. Refer to [REDIS_SESSION_SHARING.md](../REDIS_SESSION_SHARING.md) for configuration flags.

---

### 2.3 Build, Bundle & Environment Issues

#### Problem: `Module not found` or duplicate React instances
- **Cause**: Incomplete dependency installation or stale `.next` cache.
- **Resolution**:
  ```bash
  # Purge build caches and node_modules
  rm -rf .next node_modules
  pnpm install
  pnpm build
  ```

#### Problem: Environment variables undefined on client-side
- **Cause**: Missing `NEXT_PUBLIC_` prefix for client-accessible variables.
- **Resolution**:
  - Variables accessed by browser components must begin with `NEXT_PUBLIC_`.
  - Review [ENVIRONMENT_VARIABLES.md](../docs/ENVIRONMENT_VARIABLES.md) for the required matrix.

---

### 2.4 Video & Media Upload Issues

#### Problem: Media upload rejected or stalls midway
- **Cause**: File size exceeds client limit, unsupported MIME type, or storage CORS policy rejection.
- **Resolution**:
  1. Ensure media format is MP4, WebM, or supported image types.
  2. Check browser console for Sentry or API gateway error responses.
  3. Refer to [VIRUS_SCANNING_IMPLEMENTATION.md](../VIRUS_SCANNING_IMPLEMENTATION.md) for upload validation stages.

---

## 3. Error Message Catalog & Next Steps

| Error Message | Likely Root Cause | Recommended Action |
|---|---|---|
| `"Network request failed"` | API server offline or Horizon endpoint unreachable | Check local backend server and network connection |
| `"User rejected transaction"` | User closed wallet signing prompt | Retry operation and confirm prompt in wallet |
| `"Account not found on network"` | Testnet account has not been funded via Friendbot | Fund the public key with Friendbot on Testnet |
| `"Invalid sequence number"` | Out-of-order transaction submission | Refresh page to re-fetch latest account sequence |
| `"Unauthorized access"` | Session expired or missing required permissions | Log out and log back in to refresh claims |

---

## 4. Frequently Asked Questions (FAQ)

### Q: How do I test with mock data when backend services are offline?
**A**: Set `NEXT_PUBLIC_ENABLE_MOCKS=true` in your `.env.local` to enable local MSW (Mock Service Worker) handlers where available.

### Q: Why do my UI styling changes not appear immediately?
**A**: Ensure Tailwind CSS build watcher is running. Clear `.next/cache` and verify that Tailwind classes are present in the configured `content` paths in `tailwind.config.ts`.

### Q: Where can I find detailed API contract and error definitions?
**A**: Refer to [docs/API_ERROR_CODES.md](./API_ERROR_CODES.md) and [docs/API_CONTRACT_TESTING.md](./API_CONTRACT_TESTING.md).

---

## 5. Getting Further Help

If your issue persists after reviewing this guide:
1. Search existing [GitHub Issues](https://github.com/ANYTECHS/clips-frontend/issues).
2. Gather diagnostic logs from the browser DevTools Console and Network tab.
3. Open a detailed bug report following the project's issue template.
