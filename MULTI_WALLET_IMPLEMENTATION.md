# Multi-Wallet Implementation

## Overview

This implementation adds support for multiple wallets per user, allowing users to have a primary auto-wallet (embedded Stellar wallet) plus connected external wallets (MetaMask, Phantom, Freighter, etc.).

## Architecture

### Data Model

The multi-wallet system uses the following data structure stored in localStorage:

```typescript
interface MultiWalletRecord {
  id: string;                    // Unique wallet identifier
  userId: string;                // User who owns this wallet
  publicKey: string;             // Wallet address/public key
  walletType: WalletProviderType; // "embedded" | "metamask" | "phantom" | "freighter" | "stellar" | "imported"
  network?: "testnet" | "mainnet"; // Network (for Stellar wallets)
  isPrimary: boolean;            // Whether this is the primary embedded wallet
  isActive: boolean;             // Whether this wallet is currently selected
  label?: string;                // User-defined wallet label
  chainId?: string;              // Chain ID (for EVM wallets)
  _encodedSecret?: string;       // Obfuscated secret key (for embedded/imported wallets)
  createdAt: string;             // When wallet was added
  lastUsedAt: string;            // When wallet was last used
}
```

### Components

#### 1. MultiWalletStorage (`app/lib/multiWalletStorage.ts`)

Storage layer for managing multiple wallets per user. Provides methods for:
- `getAll(userId)` - Get all wallets for a user
- `getWalletData(userId)` - Get wallets with active/primary info
- `addWallet(userId, walletData)` - Add a new wallet
- `updateWallet(userId, walletId, updates)` - Update wallet metadata
- `setActiveWallet(userId, walletId)` - Switch active wallet
- `removeWallet(userId, walletId)` - Remove a wallet
- `migrateFromSingleWallet(userId, data)` - Migrate from single-wallet storage

#### 2. MultiWalletProvider (`components/MultiWalletProvider.tsx`)

React context provider that manages multi-wallet state. Provides:
- `wallets` - All wallets for the current user
- `activeWallet` - Currently selected wallet
- `primaryWallet` - Primary embedded wallet
- `addWallet()` - Add a new wallet
- `removeWallet()` - Remove a wallet
- `switchWallet()` - Switch to a different wallet
- `setPrimaryWallet()` - Set a wallet as primary
- `updateWallet()` - Update wallet metadata

#### 3. WalletSelector (`components/WalletSelector.tsx`)

UI component for wallet selection with two variants:
- **Compact variant** - For header/navbar (shows dropdown with wallet list)
- **Full variant** - For wallet cards/settings (shows detailed wallet management)

Features:
- Display all connected wallets
- Switch between wallets
- Set primary wallet
- Remove wallets (except primary)
- Copy wallet addresses
- Add new wallets

#### 4. useMultiWalletConnection (`app/hooks/useMultiWalletConnection.ts`)

Integration hook that combines the existing WalletProvider with the new MultiWalletProvider. Provides:
- All existing wallet methods from WalletProvider
- Multi-wallet operations (add, remove, switch)
- Automatic migration from single-wallet to multi-wallet storage
- Wallet reconnection when switching wallets

#### 5. Updated WalletStatus (`components/WalletStatus.tsx`)

Updated to include the WalletSelector component in the dropdown menu when the user is authenticated. This allows users to switch between wallets directly from the navbar.

## Usage

### Setup

Wrap your app with the MultiWalletProvider (in addition to WalletProvider and AuthProvider):

```tsx
<AuthProvider>
  <WalletProvider>
    <MultiWalletProvider>
      <YourApp />
    </MultiWalletProvider>
  </WalletProvider>
</AuthProvider>
```

### Adding a Wallet

```tsx
import { useMultiWalletConnection } from "@/app/hooks/useMultiWalletConnection";

function MyComponent() {
  const { connectMetaMask, connectPhantom, connectStellar } = useMultiWalletConnection();

  const handleConnect = async () => {
    await connectMetaMask(); // Automatically adds to multi-wallet list
  };
}
```

### Switching Wallets

```tsx
import { useMultiWallet } from "@/components/MultiWalletProvider";

function MyComponent() {
  const { wallets, activeWallet, switchWallet } = useMultiWallet();

  return (
    <div>
      {wallets.map(wallet => (
        <button 
          key={wallet.id}
          onClick={() => switchWallet(wallet.id)}
          className={activeWallet?.id === wallet.id ? 'active' : ''}
        >
          {wallet.label || wallet.walletType}
        </button>
      ))}
    </div>
  );
}
```

### Using WalletSelector

```tsx
import WalletSelector from "@/components/WalletSelector";
import { useAuth } from "@/components/AuthProvider";

function MyComponent() {
  const { user } = useAuth();

  return (
    <WalletSelector 
      userId={user?.id || null}
      compact={true}
      onWalletSelect={(wallet) => console.log('Selected:', wallet)}
    />
  );
}
```

## Migration

The system automatically migrates existing single-wallet storage to the new multi-wallet format on first load. The migration is handled by the `useMultiWalletConnection` hook.

To manually trigger migration:

```tsx
import { migrateToMultiWallet } from "@/components/MultiWalletProvider";

migrateToMultiWallet(userId, {
  publicKey: "0x123...",
  secretKey: "S...",
  walletType: "metamask",
  network: "testnet",
  chainId: "0x1",
});
```

## Security Considerations

- Secret keys are obfuscated using base64 encoding (NOT cryptographically secure)
- In production, replace with AES-GCM encryption via Web Crypto API
- Consider server-side encrypted vault for production deployments
- Primary wallet cannot be removed (protects the embedded wallet)
- Secret keys are only stored for embedded/imported wallets, not external wallets

## Future Enhancements

1. **Encryption Upgrade**: Replace base64 obfuscation with AES-GCM encryption
2. **Server-Side Vault**: Move wallet storage to encrypted backend API
3. **Social Recovery**: Add multi-sig and social recovery for primary wallet
4. **Wallet Labels**: Allow users to customize wallet labels
5. **Wallet Groups**: Group wallets by network or purpose
6. **Transaction History**: Per-wallet transaction history
7. **Balance Tracking**: Track balances across all wallets

## Testing

To test the multi-wallet functionality:

1. Connect to MetaMask - should add to wallet list
2. Connect to Phantom - should add to wallet list
3. Use WalletSelector to switch between wallets
4. Set a wallet as primary
5. Remove a non-primary wallet
6. Verify persistence across page refreshes

## Files Changed

- **New**: `app/lib/multiWalletStorage.ts` - Multi-wallet storage layer
- **New**: `components/MultiWalletProvider.tsx` - Multi-wallet context provider
- **New**: `components/WalletSelector.tsx` - Wallet selection UI component
- **New**: `app/hooks/useMultiWalletConnection.ts` - Integration hook
- **Modified**: `components/WalletStatus.tsx` - Added WalletSelector integration

## Backward Compatibility

The implementation maintains backward compatibility with the existing single-wallet system:
- Existing WalletProvider continues to work unchanged
- Single-wallet storage is automatically migrated to multi-wallet format
- Components that don't use multi-wallet features continue to work as before
