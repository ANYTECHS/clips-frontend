"use client";

/**
 * WalletProvider
 *
 * Wraps the app and exposes wallet state (address, loading, error)
 * plus connect / disconnect helpers via the useWallet() hook.
 *
 * Persists the connected address in localStorage so the UI survives
 * a page refresh without forcing the user to reconnect.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  connectWalletModal,
  fetchWalletBalances,
  disconnectWallet,
  getWalletNetwork,
  initWalletKit,
  openProfileModal,
  STELLAR_NETWORK,
  StellarWalletsKit,
  type StellarBalance,
  Networks,
} from "@/lib/wallet";
import type { NetworkId } from "@/lib/wallet";
import { KitEventType } from "@creit-tech/stellar-wallets-kit/types";

const STORAGE_KEY = "clipcash_wallet_address";

interface WalletContextType {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  networkPassphrase: string;
  networkUnsupported: boolean;
  balances: StellarBalance[];
  balanceError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
  /**
   * Switches the active network. The wallet keypair is reused on the new
   * network (non-custodial — keys never leave the extension) and the connected
   * public key is preserved in localStorage. The page reloads so the kit
   * re-initialises on the new network.
   */
  switchNetwork: (target: NetworkId) => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  error: null,
  networkPassphrase: STELLAR_NETWORK,
  networkUnsupported: false,
  balances: [],
  balanceError: null,
  connect: async () => {},
  disconnect: async () => {},
  openProfile: async () => {},
  switchNetwork: () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string>(STELLAR_NETWORK);
  const [networkUnsupported, setNetworkUnsupported] = useState(false);
  const [balances, setBalances] = useState<StellarBalance[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const lastBalanceAddress = useRef<string | null>(null);
  const lastBalanceNetwork = useRef<string | null>(null);
  const currentAddress = useRef<string | null>(null);
  const networkCheckInProgress = useRef<Promise<void> | null>(null);
  const networkCheckId = useRef(0);

  const refreshNetwork = useCallback(async (walletAddress: string, forceBalanceRefresh = false) => {
    if (networkCheckInProgress.current) {
      await networkCheckInProgress.current;
      return refreshNetwork(walletAddress, forceBalanceRefresh);
    }
    if (currentAddress.current !== walletAddress) return;

    const checkId = ++networkCheckId.current;
    const networkCheck = (async () => {
      try {
        let actualNetwork: string;
        try {
          actualNetwork = await getWalletNetwork();
        } catch (networkError: unknown) {
          const walletError = networkError as { code?: number; message?: string };
          const doesNotExposeNetwork =
            walletError?.code === -3 &&
            walletError.message?.toLowerCase().includes("getnetwork");
          if (!doesNotExposeNetwork) throw networkError;
          actualNetwork = STELLAR_NETWORK;
        }

        if (currentAddress.current !== walletAddress) return;
        setNetworkPassphrase(actualNetwork);
        if (actualNetwork !== STELLAR_NETWORK) {
          setNetworkUnsupported(true);
          setError("Switch your wallet to the app's supported Stellar network, then reconnect.");
          setBalances([]);
          setBalanceError(null);
          lastBalanceAddress.current = null;
          lastBalanceNetwork.current = null;
          currentAddress.current = null;
          setAddress(null);
          localStorage.removeItem(STORAGE_KEY);
          try {
            await disconnectWallet();
          } catch (disconnectError) {
            console.error("[WalletProvider] Failed to disconnect unsupported network:", disconnectError);
          }
          return;
        }

        setNetworkUnsupported(false);
        setError(null);
        const needsRefresh =
          forceBalanceRefresh ||
          lastBalanceAddress.current !== walletAddress ||
          lastBalanceNetwork.current !== actualNetwork;
        if (!needsRefresh) return;

        setBalances([]);
        setBalanceError(null);
        lastBalanceAddress.current = null;
        lastBalanceNetwork.current = null;
        try {
          const freshBalances = await fetchWalletBalances(walletAddress, actualNetwork);
          if (currentAddress.current !== walletAddress) return;
          setBalances(freshBalances);
          lastBalanceAddress.current = walletAddress;
          lastBalanceNetwork.current = actualNetwork;
        } catch (balanceFetchError) {
          console.error("[WalletProvider] Failed to refresh wallet balances:", balanceFetchError);
          setBalanceError("Wallet balances could not be refreshed.");
        }
      } catch (networkError) {
        if (currentAddress.current !== walletAddress) return;
        console.error("[WalletProvider] Failed to check wallet network:", networkError);
        setError("Could not verify the wallet network. Please try reconnecting.");
      } finally {
        if (networkCheckId.current === checkId) {
          networkCheckInProgress.current = null;
        }
      }
    })();

    networkCheckInProgress.current = networkCheck;
    return networkCheck;
  }, []);

  // On mount: initialise the kit and restore persisted address
  useEffect(() => {
    initWalletKit();

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      currentAddress.current = stored;
      setAddress(stored);
    }

    // Listen for kit-level state changes (wallet switch, disconnect)
    const unsub = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      ({ payload }) => {
        if (payload.address) {
          currentAddress.current = payload.address;
          setAddress(payload.address);
          localStorage.setItem(STORAGE_KEY, payload.address);
          void refreshNetwork(payload.address);
        }
      }
    );

    const unsubDisconnect = StellarWalletsKit.on(
      KitEventType.DISCONNECT,
      () => {
        currentAddress.current = null;
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
        setBalances([]);
        lastBalanceAddress.current = null;
        lastBalanceNetwork.current = null;
      }
    );

    return () => {
      unsub();
      unsubDisconnect();
    };
  }, [refreshNetwork]);

  useEffect(() => {
    if (!address || networkUnsupported) return;

    void refreshNetwork(address, true);
    const pollNetwork = () => {
      if (document.visibilityState === "visible") void refreshNetwork(address);
    };
    const intervalId = window.setInterval(pollNetwork, 5000);
    window.addEventListener("focus", pollNetwork);
    document.addEventListener("visibilitychange", pollNetwork);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", pollNetwork);
      document.removeEventListener("visibilitychange", pollNetwork);
    };
  }, [address, networkUnsupported, refreshNetwork]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const addr = await connectWalletModal();
      currentAddress.current = addr;
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
      await refreshNetwork(addr, true);
    } catch (err: unknown) {
      // User closed the modal (-1) is not a real error
      const kitErr = err as { code?: number; message?: string };
      if (kitErr?.code !== -1) {
        setError(kitErr?.message ?? "Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [refreshNetwork]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    currentAddress.current = null;
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
    setNetworkPassphrase(STELLAR_NETWORK);
    setNetworkUnsupported(false);
    setBalances([]);
    setBalanceError(null);
    setError(null);
    lastBalanceAddress.current = null;
    lastBalanceNetwork.current = null;
  }, []);

  const openProfile = useCallback(async () => {
    await openProfileModal();
  }, []);

  const statusError = error ?? balanceError;

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnecting,
        error,
        networkPassphrase,
        networkUnsupported,
        balances,
        balanceError,
        connect,
        disconnect,
        openProfile,
      }}
    >
      {(address || networkUnsupported) && (
        <div
          role={networkUnsupported ? "alert" : "status"}
          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs ${
            networkUnsupported
              ? "bg-amber-400/10 text-amber-200 border-b border-amber-400/30"
              : "bg-[#06351C] text-[#B6FF4A] border-b border-[#0e4d2a]"
          }`}
        >
          <span>
            {networkUnsupported
              ? `Unsupported wallet network (${networkPassphrase}). Switch to ${
                  STELLAR_NETWORK === Networks.PUBLIC ? "Stellar Mainnet" : "Stellar Testnet"
                } and reconnect.`
              : `Wallet network: ${
                  networkPassphrase === Networks.PUBLIC ? "Stellar Mainnet" : "Stellar Testnet"
                } · ${
                    statusError
                      ? statusError
                    : balances.length
                      ? balances
                          .filter((balance) => balance.assetCode === "XLM" || balance.assetCode === "USDC")
                          .map((balance) => `${balance.amount} ${balance.assetCode}`)
                          .join(" · ") || "No XLM or USDC balance"
                      : "No XLM or USDC balance"
                }`}
          </span>
          {networkUnsupported && (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="font-bold underline underline-offset-2 disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : "Reconnect wallet"}
            </button>
          )}
        </div>
      )}
      {children}
    </WalletContext.Provider>
  );
}
