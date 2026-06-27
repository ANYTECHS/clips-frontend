# Stellar Integration Guide

This document provides comprehensive guidance for developers working with Stellar features in ClipCash.

## Overview

ClipCash integrates with Stellar blockchain for NFT minting and wallet management. The platform supports multiple wallet types and provides a unified interface for blockchain interactions.

## Architecture

### Wallet System

The wallet system is built on a context-based architecture using React Context API for state management.

```
WalletProvider (Context)
├── State Management
│   ├── address: User's wallet address
│   ├── chainId: Current blockchain chain ID
│   ├── walletType: "metamask" | "phantom"
│   ├── isConnected: Connection status
│   ├── isConnecting: Connection in progress
│   └── error: Error messages
├── MetaMask Support (Ethereum/L2s)
├── Phantom Support (Solana)
└── Session Persistence (Secure Storage)
```

## Getting Started

### 1. Setup WalletProvider

Wrap your application with the `WalletProvider` at the root level:

```tsx
// app/layout.tsx
import { WalletProvider } from '@/components/WalletProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
```

### 2. Using the useWallet Hook

Access wallet state and functions in any component:

```tsx
import { useWallet } from '@/components/WalletProvider';

export default function MyComponent() {
  const {
    address,
    chainId,
    walletType,
    isConnected,
    isConnecting,
    error,
    connectMetaMask,
    connectPhantom,
    disconnect,
    clearError,
  } = useWallet();

  return (
    <div>
      {isConnected ? (
        <p>Connected: {address}</p>
      ) : (
        <div>
          <button onClick={connectMetaMask}>Connect MetaMask</button>
          <button onClick={connectPhantom}>Connect Phantom</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

## Wallet Types

### MetaMask (Ethereum/L2s)

MetaMask provides access to Ethereum and Layer 2 networks.

**Supported Networks:**
- Ethereum Mainnet (0x1)
- Polygon (0x89)
- Arbitrum (0xa4b1)
- Optimism (0xa)
- Base (0x2105)

**Connection Flow:**
1. User clicks "Connect MetaMask"
2. MetaMask extension prompts for account selection
3. User approves connection
4. Address and chain ID are retrieved
5. Session is persisted to secure storage

**Example:**
```tsx
const handleConnect = async () => {
  try {
    await connectMetaMask();
    // User is now connected
  } catch (err) {
    console.error('Connection failed:', err);
  }
};
```

### Phantom (Solana)

Phantom provides access to the Solana blockchain.

**Supported Networks:**
- Solana Mainnet
- Solana Devnet
- Solana Testnet

**Connection Flow:**
1. User clicks "Connect Phantom"
2. Phantom extension prompts for connection approval
3. User approves connection
4. Public key is retrieved and converted to Base58 format
5. Session is persisted to secure storage

**Example:**
```tsx
const handleConnect = async () => {
  try {
    await connectPhantom();
    // User is now connected to Solana
  } catch (err) {
    console.error('Connection failed:', err);
  }
};
```

## Session Management

### Persistence

Wallet sessions are automatically persisted to secure storage using the `secureStorage` utility:

```tsx
// Automatic persistence on connection
persistSession({
  address: '0x...',
  chainId: '0x1',
  walletType: 'metamask'
});

// Automatic removal on disconnect
secureStorage.removeItem('clipcash_wallet');
```

### Restoration

On app initialization, the WalletProvider automatically restores the previous session:

```tsx
// Happens automatically in useEffect
useEffect(() => {
  secureStorage.getItem('clipcash_wallet').then((stored) => {
    if (stored) {
      const parsed = JSON.parse(stored);
      // Restore wallet state
    }
  });
}, []);
```

## Event Listeners

The WalletProvider automatically listens for wallet events and updates state accordingly.

### MetaMask Events

```tsx
// Account changes (user switches accounts in MetaMask)
ethereum.on('accountsChanged', (accounts) => {
  // Update address state
});

// Chain changes (user switches networks)
ethereum.on('chainChanged', (chainId) => {
  // Update chainId state
});
```

### Phantom Events

```tsx
// Account changes (user disconnects or switches accounts)
solana.on('accountChanged', (publicKey) => {
  // Update address state
});

// Connection events
solana.on('connect', (publicKey) => {
  // Update connection state
});
```

## Error Handling

### Common Errors

**MetaMask Not Installed**
```
"MetaMask is not installed. Please install the MetaMask browser extension."
```

**Phantom Not Installed**
```
"Phantom wallet not detected. Please install the Phantom browser extension."
```

**User Rejected Connection**
```
"Connection rejected. Please approve the request in [Wallet Name]."
```

**No Accounts Available**
```
"No accounts returned. Please unlock MetaMask and try again."
```

### Error Clearing

Clear errors programmatically:

```tsx
const { error, clearError } = useWallet();

useEffect(() => {
  if (error) {
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }
}, [error, clearError]);
```

## Utility Functions

### truncateAddress

Format wallet addresses for display:

```tsx
import { truncateAddress } from '@/components/WalletProvider';

const address = '0x1234567890123456789012345678901234567890';
const truncated = truncateAddress(address); // "0x1234...7890"
```

## NFT Minting

### Mint Flow

The minting process integrates with the wallet system:

```tsx
import { useWallet } from '@/components/WalletProvider';

export default function MintComponent() {
  const { address, walletType, isConnected } = useWallet();
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = async (clipIds: string[]) => {
    if (!isConnected) {
      alert('Please connect a wallet first');
      return;
    }

    setIsMinting(true);
    try {
      // Call minting API with wallet info
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipIds,
          walletAddress: address,
          walletType,
        }),
      });

      const result = await response.json();
      console.log('Minting successful:', result);
    } catch (error) {
      console.error('Minting failed:', error);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <button onClick={() => handleMint(['clip1', 'clip2'])} disabled={!isConnected || isMinting}>
      {isMinting ? 'Minting...' : 'Mint NFTs'}
    </button>
  );
}
```

### Cost Calculation

Use the `mintUtils` for cost calculations:

```tsx
import { calculateStellarMintCost, formatXlm } from '@/app/lib/mintUtils';

const clipCount = 5;
const { gasFee, totalCost } = calculateStellarMintCost(clipCount);

console.log(`Gas: ${formatXlm(gasFee)}`);
console.log(`Total: ${formatXlm(totalCost)}`);
```

## Testing

### Unit Tests

Comprehensive tests are available in `__tests__/components/WalletProvider.test.tsx`:

```bash
npm test -- WalletProvider.test.tsx
```

**Test Coverage:**
- Initial state and session restoration
- MetaMask connection/disconnection
- Phantom connection/disconnection
- Error handling and user rejection
- Event listeners
- Session persistence
- Address truncation

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- WalletProvider.test.tsx

# Run with coverage
npm test -- --coverage
```

## Best Practices

### 1. Always Check Connection Status

```tsx
const { isConnected, connectMetaMask } = useWallet();

if (!isConnected) {
  return <button onClick={connectMetaMask}>Connect Wallet</button>;
}
```

### 2. Handle Loading States

```tsx
const { isConnecting } = useWallet();

<button disabled={isConnecting}>
  {isConnecting ? 'Connecting...' : 'Connect'}
</button>
```

### 3. Display Errors to Users

```tsx
const { error, clearError } = useWallet();

{error && (
  <div className="error-banner">
    {error}
    <button onClick={clearError}>Dismiss</button>
  </div>
)}
```

### 4. Use Truncated Addresses

```tsx
import { truncateAddress } from '@/components/WalletProvider';

const { address } = useWallet();
<span>{truncateAddress(address)}</span>
```

### 5. Persist User Preferences

```tsx
// Store wallet preference in localStorage
useEffect(() => {
  if (isConnected && walletType) {
    localStorage.setItem('preferredWallet', walletType);
  }
}, [isConnected, walletType]);
```

## Troubleshooting

### Wallet Not Connecting

1. Ensure wallet extension is installed
2. Check browser console for errors
3. Verify wallet is unlocked
4. Try refreshing the page
5. Check network connectivity

### Session Not Persisting

1. Verify secure storage is working
2. Check browser's localStorage/sessionStorage
3. Ensure cookies are not blocked
4. Clear browser cache and try again

### Wrong Network

1. Check `chainId` in wallet state
2. Manually switch network in wallet extension
3. Verify supported networks for your use case

## API Reference

### WalletProvider Props

```tsx
interface WalletProviderProps {
  children: React.ReactNode;
}
```

### useWallet Hook Return

```tsx
interface WalletContextType {
  // State
  address: string | null;
  chainId: string | null;
  walletType: 'metamask' | 'phantom' | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Methods
  connectMetaMask: () => Promise<void>;
  connectPhantom: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}
```

## Resources

- [MetaMask Documentation](https://docs.metamask.io/)
- [Phantom Documentation](https://docs.phantom.app/)
- [Stellar Documentation](https://developers.stellar.org/)
- [Web3.js Documentation](https://web3js.readthedocs.io/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

## Contributing

When adding new wallet features:

1. Update WalletProvider with new functionality
2. Add corresponding tests in `__tests__/components/WalletProvider.test.tsx`
3. Update this documentation
4. Add code comments for complex logic
5. Follow existing error handling patterns

## Support

For issues or questions:
1. Check this documentation
2. Review test files for usage examples
3. Check browser console for error messages
4. Open an issue on GitHub with detailed information
