/**
 * useMultiWalletConnection.ts
 *
 * Hook that integrates the existing WalletProvider with the new MultiWalletProvider.
 *
 * Race-condition fix (issue #514):
 * connectMetaMask() / connectPhantom() / connectStellar() / importStellarKey()
 * on WalletProvider now return the connected address directly as part of their
 * promise result. This hook reads the returned address instead of reading
 * wallet.address from React context (which may still be null at the point of
 * reading because the context re-render hasn't happened yet).
 *
 * If — for any reason — the provider returns null/undefined (older provider
 * build, edge-case error path) the hook falls back to a short poll of the
 * context state, retrying up to MAX_POLL_ATTEMPTS times with POLL_INTERVAL_MS
 * between each attempt.
 */

import { useCallback, useEffect, useRef } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useMultiWallet } from "@/components/wallet/MultiWalletProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { MultiWalletRecord, WalletProviderType } from "@/app/lib/multiWalletStorage";
import { migrateToMultiWallet } from "@/components/wallet/MultiWalletProvider";

const POLL_INTERVAL_MS = 50;
const MAX_POLL_ATTEMPTS = 20; // 1 second total

/**
 * Poll wallet.address from context until it is non-null or we time out.
 * Used as a fallback when the connect method doesn't return the address.
 * * @param getAddress - Synchronous resolver function extracting the current volatile context address value.
 * @param intervalMs - Polling delay timer gap parameter measured in milliseconds.
 * @param maxAttempts - Cap limit boundary restricting total check loops before rejecting.
 * @returns Cryptographic destination key string or null if timeout window expires.
 */
function pollAddress(
  getAddress: () => string | null,
  intervalMs: number,
  maxAttempts: number
): Promise<string | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const id = setInterval(() => {
      const address = getAddress();
      if (address) {
        clearInterval(id);
        resolve(address);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(id);
        resolve(null);
      }
    }, intervalMs);
  });
}

/**
 * Custom hook managing complex aggregate multi-chain network provider integrations.
 * Resolves context execution sync races using micro-polling fallbacks.
 * * @returns Combined standard state data, active profile arrays, transaction configurations, and operation functions.
 */
export function useMultiWalletConnection() {
  const { user } = useAuth();
  const wallet = useWallet();
  const multiWallet = useMultiWallet();

  // Keep a ref to wallet.address so pollAddress can read the latest value
  // without capturing a stale closure.
  const addressRef = useRef<string | null>(wallet.address);
  useEffect(() => {
    addressRef.current = wallet.address;
  }, [wallet.address]);

  /**
   * Resolve the address from a connect call.
   * Prefers the value returned by the connect promise; falls back to polling.
   */
  const resolveAddress = useCallback(
    async (returnedAddress: string | null | undefined): Promise<string | null> => {
      if (returnedAddress) return returnedAddress;
      // Fallback: poll context state
      return pollAddress(() => addressRef.current, POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS);
    },
    []
  );

  // Migrate existing single-wallet to multi-wallet on first load
  useEffect(() => {
    if (user?.id && wallet.isConnected && wallet.address && wallet.walletType) {
      const existingWallets = multiWallet.wallets;
      if (existingWallets.length === 0) {
        migrateToMultiWallet(user.id, {
          publicKey: wallet.address,
          secretKey: wallet.stellarSecret ?? undefined,
          walletType: wallet.walletType as WalletProviderType,
          network: wallet.chainId === "stellar" ? "testnet" : undefined,
          chainId: wallet.chainId ?? undefined,
        });
      }
    }
  }, [user?.id, wallet.isConnected, wallet.address, wallet.walletType, multiWallet.wallets]);

  /** Connect to MetaMask and add to multi-wallet list */
  const connectMetaMask = useCallback(async () => {
    const returned = await wallet.connectMetaMask();
    const address = await resolveAddress(returned);

    if (user?.id && address) {
        try {
          await multiWallet.addWallet({
            publicKey: address,
            walletType: "metamask",
            chainId: wallet.chainId ?? undefined,
            isPrimary: false,
            isActive: true,
            label: "MetaMask",
          });
        } catch (err) {
          logger.error("Failed to add MetaMask to multi-wallet list:", err);
        }
      }
  }, [wallet, user?.id, multiWallet, resolveAddress]);

  /** Connect to Phantom and add to multi-wallet list */
  const connectPhantom = useCallback(async () => {
    const returned = await wallet.connectPhantom();
    const address = await resolveAddress(returned);

    if (user?.id && address) {
        try {
          await multiWallet.addWallet({
            publicKey: address,
            walletType: "phantom",
            chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h",
            isPrimary: false,
            isActive: true,
            label: "Phantom",
          });
        } catch (err) {
          logger.error("Failed to add Phantom to multi-wallet list:", err);
        }
      }
  }, [wallet, user?.id, multiWallet, resolveAddress]);

  /** Connect to Stellar and add to multi-wallet list */
  const connectStellar = useCallback(async () => {
    const returned = await wallet.connectStellar();
    const address = await resolveAddress(returned);

    if (user?.id && address) {
        try {
          await multiWallet.addWallet({
            publicKey: address,
            walletType: "stellar",
            network: "testnet",
            isPrimary: false,
            isActive: true,
            label: "Stellar Wallet",
            _encodedSecret: wallet.stellarSecret ? btoa(wallet.stellarSecret) : undefined,
          });
        } catch (err) {
          logger.error("Failed to add Stellar to multi-wallet list:", err);
        }
      }
  }, [wallet, user?.id, multiWallet, resolveAddress]);

  /** * Import existing Stellar key and add to multi-wallet list 
   * * @param secret - The private plain text seed string target configuration block.
   */
  const importStellarKey = useCallback(async (secret: string) => {
    const returned = await wallet.importStellarKey(secret);
    const address = await resolveAddress(returned);

    if (user?.id && address) {
        try {
          await multiWallet.addWallet({
            publicKey: address,
            walletType: "imported",
            network: "testnet",
            isPrimary: false,
            isActive: true,
            label: "Imported Wallet",
            _encodedSecret: btoa(secret),
          });
        } catch (err) {
          logger.error("Failed to add imported wallet to multi-wallet list:", err);
        }
      }
  }, [wallet, user?.id, multiWallet, resolveAddress]);

  /** * Switch to a different wallet from the multi-wallet list 
   * * @param walletId - Primary identification string matching the target connection entity.
   * @throws {Error} Throws an issue descriptor context message if matching profile mappings cannot be found.
   */
  const switchWallet = useCallback(
    async (walletId: string) => {
      const targetWallet = multiWallet.wallets.find((w) => w.id === walletId);
      if (!targetWallet) throw new Error("Wallet not found");

      multiWallet.switchWallet(walletId);

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
            await wallet.importStellarKey(atob(targetWallet._encodedSecret));
          } else {
            await wallet.connectStellar();
          }
          break;
        default:
          logger.warn(`Unknown wallet type: ${targetWallet.walletType}`);
      }
    },
    [multiWallet, wallet]
  );

  /** Disconnect the current wallet */
  const disconnect = useCallback(() => {
    wallet.disconnect();
  }, [wallet]);

  /** * Remove a wallet from the multi-wallet list 
   * * @param walletId - Tracking ID target string slated for erasure processing.
   */
  const removeWallet = useCallback(
    (walletId: string) => {
      const targetWallet = multiWallet.wallets.find((w) => w.id === walletId);
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
