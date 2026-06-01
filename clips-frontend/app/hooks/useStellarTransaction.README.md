# useStellarTransaction Hook

A reusable React hook for handling Stellar blockchain transactions with Freighter wallet integration.

## Features

- ✅ **Freighter Wallet Integration** - Seamless connection with Freighter browser extension
- ✅ **Transaction Lifecycle Management** - Handles building, signing, and submitting transactions
- ✅ **Automatic Retry Logic** - Configurable retry mechanism with exponential backoff
- ✅ **Network Support** - Works with both Stellar testnet and mainnet
- ✅ **Type Safety** - Full TypeScript support with comprehensive types
- ✅ **Error Handling** - Detailed error codes and messages for debugging
- ✅ **Status Tracking** - Real-time transaction status updates
- ✅ **Cancellation Support** - Ability to cancel ongoing transactions
- ✅ **Callbacks** - Success and error callbacks for custom handling

## Installation

First, install the Stellar SDK (if not already installed):

```bash
npm install stellar-sdk
# or
yarn add stellar-sdk
```

The hook is already included in the project at `app/hooks/useStellarTransaction.ts`.

## Basic Usage

```tsx
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";

function MyComponent() {
  const { executeTransaction, status, error, result } = useStellarTransaction({
    network: "testnet",
    onSuccess: (result) => {
      console.log("Transaction successful:", result.hash);
    },
    onError: (error) => {
      console.error("Transaction failed:", error.message);
    },
  });

  const handleTransaction = async () => {
    await executeTransaction(async () => {
      // Build your transaction here using stellar-sdk
      const transaction = buildMyTransaction();
      return transaction.toXDR();
    });
  };

  return (
    <div>
      <button onClick={handleTransaction} disabled={status === "submitting"}>
        {status === "submitting" ? "Processing..." : "Send Transaction"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {result && <p>Success! Hash: {result.hash}</p>}
    </div>
  );
}
```

## API Reference

### Hook Options

```typescript
interface StellarTransactionOptions {
  network?: "testnet" | "mainnet"; // Default: "testnet"
  timeout?: number; // Request timeout in ms. Default: 30000
  maxRetries?: number; // Max retry attempts. Default: 3
  onSuccess?: (result: StellarTransactionResult) => void;
  onError?: (error: StellarTransactionError) => void;
}
```

### Return Values

```typescript
{
  // State
  status: "idle" | "building" | "signing" | "submitting" | "success" | "error";
  isLoading: boolean;
  error: StellarTransactionError | null;
  result: StellarTransactionResult | null;
  transactionHash: string | null;

  // Actions
  executeTransaction: (builder: TransactionBuilder) => Promise<StellarTransactionResult | null>;
  reset: () => void;
  cancel: () => void;

  // Utilities
  checkFreighterInstalled: () => boolean;
  getPublicKey: () => Promise<string>;
}
```

### Transaction Result

```typescript
interface StellarTransactionResult {
  hash: string; // Transaction hash
  ledger: number; // Ledger number
  envelope_xdr: string; // Transaction envelope XDR
  result_xdr: string; // Transaction result XDR
  result_meta_xdr: string; // Transaction metadata XDR
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `FREIGHTER_NOT_INSTALLED` | Freighter wallet extension is not installed |
| `PUBLIC_KEY_ERROR` | Failed to retrieve public key from Freighter |
| `USER_REJECTED` | User rejected the transaction in Freighter |
| `SIGNING_ERROR` | Failed to sign the transaction |
| `SUBMISSION_ERROR` | Failed to submit transaction to Stellar network |
| `NETWORK_ERROR` | Network connection error |
| `TIMEOUT` | Transaction submission timed out |
| `tx_*` | Stellar-specific transaction errors (e.g., `tx_insufficient_balance`) |

## Advanced Examples

### Payment Transaction

```tsx
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";
import * as StellarSdk from "stellar-sdk";

function PaymentForm() {
  const { executeTransaction, status, error } = useStellarTransaction({
    network: "testnet",
  });

  const sendPayment = async (destination: string, amount: string) => {
    await executeTransaction(async () => {
      const server = new StellarSdk.Server(
        "https://horizon-testnet.stellar.org"
      );

      // Get the source account
      const sourcePublicKey = await window.freighter?.getPublicKey();
      if (!sourcePublicKey) throw new Error("No public key");

      const account = await server.loadAccount(sourcePublicKey);

      // Build the transaction
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: StellarSdk.Asset.native(),
            amount,
          })
        )
        .setTimeout(30)
        .build();

      return transaction.toXDR();
    });
  };

  return (
    <div>
      <button onClick={() => sendPayment("GDEST...", "10")}>
        Send 10 XLM
      </button>
      {status === "signing" && <p>Please approve in Freighter...</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### NFT Minting

```tsx
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";
import * as StellarSdk from "stellar-sdk";

function MintNFT() {
  const { executeTransaction, status, result } = useStellarTransaction({
    network: "mainnet",
    maxRetries: 5,
    onSuccess: (result) => {
      console.log("NFT minted! Hash:", result.hash);
      // Update your database, show success message, etc.
    },
  });

  const mintNFT = async (metadata: string) => {
    await executeTransaction(async () => {
      const server = new StellarSdk.Server("https://horizon.stellar.org");
      const sourcePublicKey = await window.freighter?.getPublicKey();
      if (!sourcePublicKey) throw new Error("No public key");

      const account = await server.loadAccount(sourcePublicKey);

      // Create NFT asset
      const nftAsset = new StellarSdk.Asset("NFT", sourcePublicKey);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.PUBLIC,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: nftAsset,
            limit: "1",
          })
        )
        .addOperation(
          StellarSdk.Operation.payment({
            destination: sourcePublicKey,
            asset: nftAsset,
            amount: "1",
          })
        )
        .addOperation(
          StellarSdk.Operation.manageData({
            name: "ipfs_hash",
            value: metadata,
          })
        )
        .setTimeout(30)
        .build();

      return transaction.toXDR();
    });
  };

  return (
    <div>
      <button onClick={() => mintNFT("QmXYZ...")}>Mint NFT</button>
      {status === "submitting" && <p>Minting...</p>}
      {result && <p>Minted! View on explorer: {result.hash}</p>}
    </div>
  );
}
```

### With Loading States

```tsx
function TransactionWithStates() {
  const { executeTransaction, status, isLoading } = useStellarTransaction();

  const getStatusMessage = () => {
    switch (status) {
      case "building":
        return "Building transaction...";
      case "signing":
        return "Please approve in Freighter wallet";
      case "submitting":
        return "Submitting to Stellar network...";
      case "success":
        return "Transaction successful!";
      case "error":
        return "Transaction failed";
      default:
        return "Ready";
    }
  };

  return (
    <div>
      <p>Status: {getStatusMessage()}</p>
      <button disabled={isLoading}>
        {isLoading ? "Processing..." : "Send Transaction"}
      </button>
    </div>
  );
}
```

### Manual Retry Logic

```tsx
function ManualRetry() {
  const { executeTransaction, error, reset } = useStellarTransaction({
    maxRetries: 1, // Don't auto-retry
  });

  const handleRetry = () => {
    reset(); // Clear error state
    executeTransaction(buildTransaction);
  };

  return (
    <div>
      {error && (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={handleRetry}>Retry</button>
        </div>
      )}
    </div>
  );
}
```

### Cancelling Transactions

```tsx
function CancellableTransaction() {
  const { executeTransaction, cancel, status } = useStellarTransaction();

  const handleCancel = () => {
    cancel();
    console.log("Transaction cancelled");
  };

  return (
    <div>
      <button onClick={() => executeTransaction(buildTransaction)}>
        Start Transaction
      </button>
      {status === "submitting" && (
        <button onClick={handleCancel}>Cancel</button>
      )}
    </div>
  );
}
```

## Error Handling Best Practices

```tsx
function ErrorHandling() {
  const { executeTransaction, error } = useStellarTransaction({
    onError: (error) => {
      // Log to error tracking service
      console.error("Transaction error:", error);

      // Show user-friendly messages
      switch (error.code) {
        case "FREIGHTER_NOT_INSTALLED":
          alert("Please install Freighter wallet");
          break;
        case "USER_REJECTED":
          // User cancelled, no need to show error
          break;
        case "tx_insufficient_balance":
          alert("Insufficient balance for this transaction");
          break;
        default:
          alert("Transaction failed. Please try again.");
      }
    },
  });

  return <div>{/* Your UI */}</div>;
}
```

## Testing

The hook includes comprehensive tests. Run them with:

```bash
npm test useStellarTransaction.test.ts
# or
yarn test useStellarTransaction.test.ts
```

## Requirements

- **Freighter Wallet**: Users must have the [Freighter browser extension](https://www.freighter.app/) installed
- **Stellar SDK**: Install `stellar-sdk` package for building transactions
- **React 18+**: The hook uses modern React features

## Browser Support

The hook works in all modern browsers that support:
- ES6+ JavaScript
- Browser extensions (for Freighter)
- Fetch API

## Security Considerations

1. **Never expose secret keys**: Always use Freighter for signing, never handle secret keys in your frontend code
2. **Validate inputs**: Always validate transaction parameters before building transactions
3. **Use HTTPS**: Ensure your app is served over HTTPS in production
4. **Network selection**: Be careful when switching between testnet and mainnet
5. **Amount validation**: Always validate and sanitize amount inputs to prevent errors

## Troubleshooting

### "Freighter is not installed" error
- Ensure the Freighter browser extension is installed
- Check that the extension is enabled
- Try refreshing the page

### "User rejected" error
- This is normal when users decline the transaction
- Don't show this as an error to users
- Allow them to retry if needed

### Transaction timeout
- Increase the `timeout` option
- Check network connectivity
- Verify Stellar network status

### "Insufficient balance" error
- Check the account has enough XLM for the transaction
- Remember to account for transaction fees
- Ensure minimum balance requirements are met

## Contributing

To improve this hook:
1. Add new features in `useStellarTransaction.ts`
2. Add corresponding tests in `useStellarTransaction.test.ts`
3. Update this README with examples
4. Ensure all tests pass

## License

This hook is part of the ClipCash project and follows the project's license.

## Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Freighter Wallet](https://www.freighter.app/)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [Horizon API](https://developers.stellar.org/api/horizon)
