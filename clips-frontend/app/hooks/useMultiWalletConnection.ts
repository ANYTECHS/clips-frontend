/**
 * useMultiWalletConnection.ts
 *
 * Hook that integrates the existing WalletProvider with the new MultiWalletProvider.
 * 
 * This hook provides a unified interface for:
 * - Connecting to external wallets (MetaMask, Phantom, etc.)
 * - Managing multiple wallets per user
 * - Switching between wallets
 * - Maintaining the primary embedded wallet
 */

import { useCallback, useEffect } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useMultiWallet } from "@/components/MultiWalletProvider";
import { useAuth } from "@/components/AuthProvider";
import { MultiWalletRecord, WalletProviderType } from "@/app/lib/multiWalletStorage";
import { migrateToMultiWallet } from "@/components/MultiWalletProvider";

export function useMultiWalletConnection() {
  const { user } = useAuth();
  const wallet = useWallet();
  const multiWallet = useMultiWallet();

  // Migrate existing single-wallet to multi-wallet on first load
  useEffect(() => {
    if (user?.id && wallet.isConnected && wallet.address && wallet.walletType) {
      const existingWallets = multiWallet.wallets;
      
      // Only migrate if no wallets exist yet
      if (existingWallets.length === 0) {
        migrateToMultiWallet(user.id, {
          publicKey: wallet.address,
          secretKey: wallet.stellarSecret || undefined,
          walletType: wallet.walletType as WalletProviderType,
          network: wallet.chainId === "stellar" ? "testnet" : undefined,
          chainId: wallet.chainId || undefined,
        });
      }
    }
  }, [user?.id, wallet.isConnected, wallet.address, wallet.walletType, multiWallet.wallets]);

  /**
   * Connect to MetaMask and add to multi-wallet list
   */
  const connectMetaMask = useCallback(async () => {
    await wallet.connectMetaMask();
    
    if (user?.id && wallet.address) {
      try {
        await multiWallet.addWallet({
          publicKey: wallet.address,
          walletType: "metamask",
          chainId: wallet.chainId || undefined,
          isPrimary: false,
          isActive: true,
          label: "MetaMask",
        });
      } catch (err) {
        console.error("Failed to add MetaMask to multi-wallet list:", err);
      }
    }
  }, [wallet, user?.id, multiWallet]);

  /**
   * Connect to Phantom and add to multi-wallet list
   */
  const connectPhantom = useCallback(async () => {
    await wallet.connectPhantom();
    
    if (user?.id && wallet.address) {
      try {
        await multiWallet.addWallet({
          publicKey: wallet.address,
          walletType: "phantom",
          chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h",
          isPrimary: false,
          isActive: true,
          label: "Phantom",
        });
      } catch (err) {
        console.error("Failed to add Phantom to multi-wallet list:", err);
      }
    }
  }, [wallet, user?.id, multiWallet]);

  /**
   * Connect to Stellar and add to multi-wallet list
   */
  const connectStellar = useCallback(async () => {
    await wallet.connectStellar();
    
    if (user?.id && wallet.address) {
      try {
        await multiWallet.addWallet({
          publicKey: wallet.address,
          walletType: "stellar",
          network: "testnet",
          isPrimary: false,
          isActive: true,
          label: "Stellar Wallet",
          _encodedSecret: wallet.stellarSecret ? btoa(wallet.stellarSecret) : undefined,
        });
      } catch (err) {
        console.error("Failed to add Stellar to multi-wallet list:", err);
      }
    }
  }, [wallet, user?.id, multiWallet]);

  /**
   * Import existing Stellar key and add to multi-wallet list
   */
  const importStellarKey = useCallback(async (secret: string) => {
    await wallet.importStellarKey(secret);
    
    if (user?.id && wallet.address) {
      try {
        await multiWallet.addWallet({
          publicKey: wallet.address,
          walletType: "imported",
          network: "testnet",
          isPrimary: false,
          isActive: true,
          label: "Imported Wallet",
          _encodedSecret: btoa(secret),
        });
      } catch (err) {
        console.error("Failed to add imported wallet to multi-wallet list:", err);
      }
    }
  }, [wallet, user?.id, multiWallet]);

  /**
   * Switch to a different wallet from the multi-wallet list
   */
  const switchWallet = useCallback(
    async (walletId: string) => {
      const targetWallet = multiWallet.wallets.find((w) => w.id === walletId);
      if (!targetWallet) {
        throw new Error("Wallet not found");
      }

      // Update multi-wallet active state
      multiWallet.switchWallet(walletId);

      // Reconnect to the wallet using the appropriate method
      switch (targetWallet.walletType) {
        case "metamask":
          await wallet.connectMetaMask();
          break;
        case "phantom":
          await wallet.connectPhantom();
          break;
        case "stellar":
        case "embedded":
        case "imported":
          if (targetWallet._encodedSecret) {
            const secret = atob(targetWallet._encodedSecret);
            await wallet.importStellarKey(secret);
          } else {
            await wallet.connectStellar();
          }
          break;
        default:
          console.warn(`Unknown wallet type: ${targetWallet.walletType}`);
      }
    },
    [multiWallet, wallet]
  );

  /**
   * Disconnect the current wallet
   */
  const disconnect = useCallback(() => {
    wallet.disconnect();
  }, [wallet]);

  /**
   * Remove a wallet from the multi-wallet list
   */
  const removeWallet = useCallback(
    (walletId: string) => {
      const targetWallet = multiWallet.wallets.find((w) => w.id === walletId);
      
      // If removing the currently connected wallet, disconnect it
      if (targetWallet?.publicKey === wallet.address) {
        wallet.disconnect();
      }
      
      multiWallet.removeWallet(walletId);
    },
    [multiWallet, wallet]
  );

  return {
    // Existing wallet state
    ...wallet,
    
    // Multi-wallet state
    wallets: multiWallet.wallets,
    activeWallet: multiWallet.activeWallet,
    primaryWallet: multiWallet.primaryWallet,
    
    // Multi-wallet operations
    connectMetaMask,
    connectPhantom,
    connectStellar,
    importStellarKey,
    switchWallet,
    removeWallet,
    setPrimaryWallet: multiWallet.setPrimaryWallet,
    updateWallet: multiWallet.updateWallet,
    
    // Error handling
    isOperating: multiWallet.isOperating,
    multiWalletError: multiWallet.error,
    clearMultiWalletError: multiWallet.clearError,
  };
}
