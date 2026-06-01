# Error Monitoring & Logging for Wallet Operations

## Overview

This implementation adds comprehensive error monitoring and logging for wallet operations using Sentry. The system tracks wallet connection errors, transaction failures, and other critical wallet events while protecting user privacy by redacting sensitive information.

## Architecture

### Components

#### 1. Sentry Configuration (`sentry.client.config.ts`)

Client-side Sentry configuration for Next.js applications:
- Performance monitoring with configurable sampling rates
- Session replay for debugging user interactions
- PII filtering to protect sensitive data
- Error filtering to ignore expected errors (user cancellations, network issues)

#### 2. Sentry Utility (`app/lib/sentry.ts`)

Helper functions for Sentry integration:
- `initSentry()` - Initialize Sentry client
- `captureWalletError()` - Capture wallet-specific errors with context
- `captureWalletEvent()` - Track wallet events (success, warnings)
- `addWalletBreadcrumb()` - Add breadcrumbs for operation tracking
- `setSentryUser()` - Set user context for error reports
- `redactAddress()` - Redact wallet addresses for logging

#### 3. Wallet Error Tracking Utility (`app/lib/walletErrorTracking.ts`)

Lightweight error tracking utility that works with or without Sentry:
- Falls back to console logging if Sentry is not available
- PII redaction for all logged data
- Structured logging for wallet operations
- React hook for easy integration

**Key Functions:**
- `captureWalletError(error, operation, context)` - Capture errors with context
- `captureWalletEvent(event, context)` - Track events
- `addWalletBreadcrumb(message, category, data)` - Add breadcrumbs
- `logWalletOperation(operation, status, data)` - Log operations
- `withWalletErrorTracking(fn)` - Wrap functions with error tracking
- `setWalletUserContext(user)` - Set user context

#### 4. WalletProvider Integration

Error tracking added to all wallet operations:
- `connectMetaMask()` - MetaMask connection errors
- `connectPhantom()` - Phantom connection errors
- `connectStellar()` - Stellar wallet creation/connection errors
- `importStellarKey()` - Secret key import errors

#### 5. MultiWalletProvider Integration

Error tracking added to multi-wallet operations:
- `addWallet()` - Wallet addition errors
- `removeWallet()` - Wallet removal errors
- `switchWallet()` - Wallet switching errors
- `setPrimaryWallet()` - Primary wallet change errors
- `updateWallet()` - Wallet metadata update errors

## Installation

### 1. Install Sentry SDK

```bash
npm install @sentry/nextjs
```

### 2. Configure Environment Variables

Add to `.env.local`:

```env
# Sentry DSN (get from Sentry.io)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Environment (development, staging, production)
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Release identifier (optional, uses git commit SHA on Vercel)
NEXT_PUBLIC_SENTRY_RELEASE=v1.0.0
```

### 3. Initialize Sentry

The Sentry configuration is automatically loaded by Next.js when you create the config files:
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration (optional)
- `sentry.edge.config.ts` - Edge runtime configuration (optional)

## Usage

### Basic Error Tracking

```tsx
import { captureWalletError, logWalletOperation } from "@/app/lib/walletErrorTracking";

try {
  await someWalletOperation();
  logWalletOperation("operation_name", "success", { walletAddress: "0x..." });
} catch (error) {
  captureWalletError(error, "operation_name", { 
    walletType: "metamask",
    walletAddress: "0x...",
  });
  throw error;
}
```

### Using the React Hook

```tsx
import { useWalletErrorTracking } from "@/app/lib/walletErrorTracking";

function MyComponent() {
  const { captureError, logOperation, addBreadcrumb } = useWalletErrorTracking();

  const handleConnect = async () => {
    addBreadcrumb("Starting wallet connection", "wallet");
    try {
      await connectWallet();
      logOperation("connect_wallet", "success", { walletType: "metamask" });
    } catch (error) {
      captureError(error, "connect_wallet", { walletType: "metamask" });
    }
  };

  return <button onClick={handleConnect}>Connect</button>;
}
```

### Wrapping Functions with Error Tracking

```tsx
import { withWalletErrorTracking } from "@/app/lib/walletErrorTracking";

const connectWallet = withWalletErrorTracking(
  "connect_wallet",
  async () => {
    // Your wallet connection logic
  }
);
```

### Setting User Context

User context is automatically set in `MultiWalletProvider` when a user authenticates. For manual context setting:

```tsx
import { setWalletUserContext } from "@/app/lib/walletErrorTracking";

// Set user context
setWalletUserContext({ id: "user-123", email: "user@example.com" });

// Clear user context
setWalletUserContext(null);
```

## Tracked Operations

### Wallet Connection Operations
- `connect_metamask` - MetaMask wallet connection
- `connect_phantom` - Phantom wallet connection
- `connect_stellar` - Stellar wallet creation/connection
- `import_stellar_key` - Stellar secret key import

### Multi-Wallet Operations
- `add_wallet` - Add wallet to multi-wallet list
- `remove_wallet` - Remove wallet from list
- `switch_wallet` - Switch active wallet
- `set_primary_wallet` - Set primary wallet
- `update_wallet` - Update wallet metadata

### Transaction Operations
- `send_payment` - Send XLM payment
- `fund_wallet` - Fund wallet via Friendbot
- `refresh_balance` - Refresh wallet balance

## Data Redaction

All sensitive data is automatically redacted before logging:

- **Wallet Addresses**: Shows first 6 and last 4 characters (e.g., `0x1234...5678`)
- **Email Addresses**: Shows first character and domain (e.g., `j***@example.com`)
- **Secret Keys**: Completely redacted (`[REDACTED]`)
- **Private Keys**: Completely redacted (`[REDACTED]`)
- **Mnemonic Phrases**: Completely redacted (`[REDACTED]`)

## Error Filtering

Sentry is configured to ignore expected errors:

```typescript
ignoreErrors: [
  "Network request failed",
  "Failed to fetch",
  "User rejected the request",
  "User cancelled the request",
  "Extension context invalidated",
]
```

## Performance Monitoring

Performance monitoring is enabled with configurable sampling rates:

```typescript
// Production: 10% of transactions
tracesSampleRate: 0.1

// Development: 100% of transactions
tracesSampleRate: 1.0
```

## Session Replay

Session replay captures user interactions for debugging:

```typescript
// Production: 10% of sessions
replaysSessionSampleRate: 0.1

// All error sessions
replaysOnErrorSampleRate: 1.0
```

**Privacy Settings:**
- Mask all text: `false` (allows reading UI text)
- Mask all inputs: `true` (protects sensitive input)
- Block all media: `true` (protects images/videos)

## Environment-Specific Configuration

### Development
- Full performance tracing (100%)
- Full session replay (100%)
- Console logging enabled
- Sentry DSN optional (falls back to console)

### Production
- Sampled performance tracing (10%)
- Sampled session replay (10%)
- Error-only session replay (100%)
- Sentry DSN required

## Analytics Integration

Error tracking works alongside the existing analytics system:

```tsx
import analytics from "@/lib/analytics";
import { captureWalletError } from "@/app/lib/walletErrorTracking";

try {
  await connectWallet();
  // Track success in analytics
  analytics.trackWalletConnect("metamask");
} catch (error) {
  // Track error in Sentry
  captureWalletError(error, "connect_metamask", { walletType: "metamask" });
  // Track failure in analytics
  analytics.trackEvent('wallet_connection_failed', { wallet_type: 'metamask' });
}
```

## Testing

### Local Testing

Without a Sentry DSN configured, the system falls back to console logging:

```typescript
// Console output:
[Wallet Error] connect_metamask Error: MetaMask is not installed
{
  operation: "connect_metamask",
  walletType: "metamask",
  walletAddress: "[REDACTED]"
}
```

### Sentry Testing

To test Sentry integration:

1. Configure `NEXT_PUBLIC_SENTRY_DSN`
2. Trigger a wallet error (e.g., try to connect without MetaMask installed)
3. Check Sentry dashboard for the error report

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify Sentry is initialized (check browser console for Sentry logs)
3. Ensure error is not in the `ignoreErrors` list
4. Check network connectivity to Sentry

### Too Many Errors

Adjust sampling rates in `sentry.client.config.ts`:

```typescript
// Reduce performance monitoring
tracesSampleRate: 0.05 // 5% instead of 10%

// Reduce session replay
replaysSessionSampleRate: 0.05 // 5% instead of 10%
```

### Sensitive Data Leaking

Ensure all sensitive fields are redacted:
- Check custom context objects for PII
- Verify breadcrumbs don't contain secrets
- Review error messages for embedded sensitive data

## Security Considerations

### PII Protection

- All wallet addresses are redacted before logging
- Secret keys are never logged
- User emails are partially redacted
- Custom context data is sanitized

### Data Retention

Configure data retention in Sentry:
- Error events: 30-90 days
- Performance data: 30 days
- Session replays: 7-30 days

### Access Control

- Restrict Sentry access to authorized team members
- Use Sentry's team-based access controls
- Enable IP allowlisting for production
- Use Sentry's data scrubbing features

## Files Modified

- **New**: `sentry.client.config.ts` - Sentry client configuration
- **New**: `app/lib/sentry.ts` - Sentry helper utilities
- **New**: `app/lib/walletErrorTracking.ts` - Wallet error tracking utility
- **Modified**: `components/WalletProvider.tsx` - Added error tracking to wallet operations
- **Modified**: `components/MultiWalletProvider.tsx` - Added error tracking to multi-wallet operations

## Next Steps

1. **Server-Side Monitoring**: Add server-side Sentry configuration for API routes
2. **Custom Alerting**: Configure Sentry alerts for critical wallet errors
3. **Dashboards**: Create Sentry dashboards for wallet operation metrics
4. **Error Rate Monitoring**: Set up error rate alerts for wallet operations
5. **Performance Budgets**: Configure performance budgets for wallet operations

## References

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)
- [Sentry Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
