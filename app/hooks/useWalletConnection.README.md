# useWalletConnection Hook

A reusable React hook for managing Freighter wallet connections in the ClipCash application.

## Features

- ✅ **Freighter Wallet Integration** - Seamless connection with Freighter browser extension
- ✅ **Connection State Management** - Tracks connection status and loading states
- ✅ **Auto-reconnect** - Automatically reconnects if user was previously connected
- ✅ **Network Detection** - Detects and displays current network (testnet/mainnet)
- ✅ **Address Truncation** - Utility to display shortened wallet addresses
- ✅ **Type Safety** - Full TypeScript support with comprehensive types
- ✅ **Error Handling** - Detailed error codes and messages
- ✅ **User-friendly** - Handles user rejection gracefully

## Installation

The hook is already included in the project at `app/hooks/useWalletConnection.ts`.

## Basic Usage

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";

function WalletButton() {
  const {
    connect,
    disconnect,
    isConnecting,
    isConnected,
    publicKey,
    error,
    getTruncatedAddress,
  } = useWalletConnection();

  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      console.log("Connected to wallet:", publicKey);
    }
  };

  return (
    <div>
      {!isConnected ? (
        <button onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <div>
          <span>Connected: {getTruncatedAddress(publicKey!)}</span>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

## API Reference

### Return Values

```typescript
{
  // State
  status: "disconnected" | "connecting" | "connected" | "error";
  isConnecting: boolean;
  isConnected: boolean;
  error: WalletConnectionError | null;
  publicKey: string | null;
  network: "PUBLIC" | "TESTNET" | null;

  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  resetError: () => void;

  // Utilities
  checkFreighterInstalled: () => boolean;
  getTruncatedAddress: (address: string) => string;
}
```

### Connection Status

| Status | Description |
|--------|-------------|
| `disconnected` | Wallet is not connected |
| `connecting` | Connection in progress |
| `connected` | Wallet successfully connected |
| `error` | Connection failed |

### Error Codes

| Code | Description |
|------|-------------|
| `FREIGHTER_NOT_INSTALLED` | Freighter extension not found |
| `USER_REJECTED` | User declined connection |
| `CONNECTION_ERROR` | General connection error |

## Examples

### Basic Connection Button

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { Wallet, Loader2 } from "lucide-react";

function ConnectButton() {
  const { connect, isConnecting } = useWalletConnection();

  return (
    <button onClick={connect} disabled={isConnecting}>
      {isConnecting ? (
        <>
          <Loader2 className="animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet />
          Connect Wallet
        </>
      )}
    </button>
  );
}
```

### Connected State Display

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { CheckCircle } from "lucide-react";

function WalletStatus() {
  const {
    isConnected,
    publicKey,
    network,
    disconnect,
    getTruncatedAddress,
  } = useWalletConnection();

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-2">
      <CheckCircle className="text-green-500" />
      <span>{getTruncatedAddress(publicKey!)}</span>
      <span className="text-sm text-gray-500">({network})</span>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### Error Handling

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { AlertCircle } from "lucide-react";

function WalletWithError() {
  const { connect, error, resetError } = useWalletConnection();

  const handleConnect = async () => {
    resetError(); // Clear previous errors
    const success = await connect();
    
    if (!success && error) {
      // Handle specific errors
      switch (error.code) {
        case "FREIGHTER_NOT_INSTALLED":
          alert("Please install Freighter wallet extension");
          break;
        case "USER_REJECTED":
          // User cancelled, no need to show error
          break;
        default:
          alert(error.message);
      }
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect Wallet</button>
      {error && (
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
}
```

### Complete Auth Form Integration

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { Wallet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

function AuthForm() {
  const {
    connect,
    disconnect,
    isConnecting,
    isConnected,
    publicKey,
    error,
    getTruncatedAddress,
    resetError,
  } = useWalletConnection();

  const handleConnect = async () => {
    resetError();
    const success = await connect();
    if (success) {
      console.log("Wallet connected successfully!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Other auth buttons (Google, Apple, etc.) */}
      
      {/* Wallet Connection Button */}
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-3 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand py-3.5 rounded-xl font-medium transition-all disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting Wallet...
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Connect Stellar Wallet
            </>
          )}
        </button>
      ) : (
        <div className="w-full flex items-center justify-between gap-3 bg-brand/10 border border-brand/30 text-brand py-3.5 px-4 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              {getTruncatedAddress(publicKey!)}
            </span>
          </div>
          <button
            onClick={disconnect}
            className="text-brand/70 hover:text-brand text-sm font-medium underline"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-500 text-sm">{error.message}</p>
        </div>
      )}
    </div>
  );
}
```

### With Toast Notifications

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { useToast } from "@/hooks/useToast";

function WalletWithToast() {
  const { connect, disconnect, publicKey } = useWalletConnection();
  const { showToast } = useToast();

  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      showToast("Wallet connected successfully!", "success");
    } else {
      showToast("Failed to connect wallet", "error");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    showToast("Wallet disconnected", "info");
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect</button>
      {publicKey && (
        <button onClick={handleDisconnect}>Disconnect</button>
      )}
    </div>
  );
}
```

## Auto-reconnect Behavior

The hook automatically attempts to reconnect on mount if the user was previously connected:

```tsx
// On component mount, the hook checks:
// 1. Is Freighter installed?
// 2. Is the user already connected?
// 3. If yes, restore the connection state

function MyApp() {
  const { isConnected, publicKey } = useWalletConnection();

  // User will be automatically reconnected if they were
  // previously connected in this session
  
  return (
    <div>
      {isConnected && <p>Welcome back! {publicKey}</p>}
    </div>
  );
}
```

## Testing

The hook includes comprehensive tests. Run them with:

```bash
npm test useWalletConnection.test.ts
# or
yarn test useWalletConnection.test.ts
```

## Requirements

- **Freighter Wallet**: Users must have the [Freighter browser extension](https://www.freighter.app/) installed
- **React 18+**: The hook uses modern React features

## Browser Support

The hook works in all modern browsers that support:
- ES6+ JavaScript
- Browser extensions (for Freighter)
- Async/await

## Security Considerations

1. **Never expose secret keys**: The hook only retrieves public keys
2. **User consent**: Connection always requires user approval in Freighter
3. **Network awareness**: Always check which network the user is connected to
4. **Error handling**: Handle all error cases gracefully

## Troubleshooting

### "Freighter is not installed" error
- Ensure the Freighter browser extension is installed
- Check that the extension is enabled
- Try refreshing the page

### "User rejected" error
- This is normal when users decline the connection
- Don't show this as an error to users
- Allow them to retry if needed

### Auto-reconnect not working
- Check browser console for errors
- Ensure Freighter is still connected
- Try manually connecting again

### Network mismatch
- Check which network the user has selected in Freighter
- Display the current network to the user
- Warn users if they're on the wrong network for your app

## Integration with Other Hooks

### With useStellarTransaction

```tsx
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";

function MintNFT() {
  const { isConnected, publicKey } = useWalletConnection();
  const { executeTransaction, status } = useStellarTransaction();

  const handleMint = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    await executeTransaction(async () => {
      // Build transaction using publicKey
      const transaction = await buildMintTransaction(publicKey!);
      return transaction.toXDR();
    });
  };

  return (
    <button onClick={handleMint} disabled={!isConnected || status === "submitting"}>
      Mint NFT
    </button>
  );
}
```

## Contributing

To improve this hook:
1. Add new features in `useWalletConnection.ts`
2. Add corresponding tests in `useWalletConnection.test.ts`
3. Update this README with examples
4. Ensure all tests pass

## License

This hook is part of the ClipCash project and follows the project's license.

## Resources

- [Freighter Wallet](https://www.freighter.app/)
- [Freighter Documentation](https://docs.freighter.app/)
- [Stellar Documentation](https://developers.stellar.org/)
