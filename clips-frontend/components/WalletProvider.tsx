"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { secureStorage, getSecureStorageWarning } from "@/app/lib/secureStorage";
import { useToast } from "@/hooks/useToast";
import analytics, { bucketAmount } from "@/lib/analytics";
import { captureWalletError, logWalletOperation, addWalletBreadcrumb } from "@/app/lib/walletErrorTracking";

/**
 * WalletProvider - Manages wallet connections and state for MetaMask and Phantom wallets
 * 
 * This provider handles:
 * - Wallet connection/disconnection for MetaMask (Ethereum/L2s) and Phantom (Solana)
 * - Session persistence using secure storage
 * - Event listener management for wallet changes
 * - Error handling and user feedback
 * 
 * Usage:
 * ```tsx
 * <WalletProvider>
 *   <YourApp />
 * </WalletProvider>
 * ```
 * 
 * Then use the useWallet hook in any component:
 * ```tsx
 * const { address, isConnected, connectMetaMask } = useWallet();
 * ```
 */

// EIP-1193 provider type (window.ethereum)
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
      disconnect: () => Promise<void>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      publicKey?: {
        toBase58: () => string;
      };
    };
  }
}

export type WalletType = "metamask" | "phantom" | "stellar";

export interface WalletState {
  address: string | null;
  chainId: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isConnecting: boolean;
  isRestoringSession: boolean;
  error: string | null;
}

export interface PendingTransaction {
  id: string;
  publicKey: string;
  type: "sent" | "received";
  amount: string;
  asset: string;
  counterparty: string;
  timestamp: string;
  txHash: string;
  status: "pending" | "failed";
}

interface WalletContextType extends WalletState {
  connectMetaMask: () => Promise<void>;
  connectPhantom: () => Promise<void>;
  connectStellar: () => Promise<void>;
  importStellarKey: (secret: string) => Promise<void>;
  fundWithFriendbot: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  sendXlmPayment: (destination: string, amount: string) => Promise<{ success: boolean; hash: string }>;
  pendingTransactions: PendingTransaction[];
  addPendingTransaction: (tx: Omit<PendingTransaction, "id">) => string;
  removePendingTransaction: (id: string) => void;
  updatePendingTransaction: (id: string, updates: Partial<PendingTransaction>) => void;
  disconnect: () => void;
  clearError: () => void;
  balance: string | null;
  stellarSecret: string | null;
  stellarMnemonic: string | null;
}

const STORAGE_KEY = "clipcash_wallet";

/**
 * Allowed chain IDs.
 * 0x1 = Ethereum Mainnet, 0xaa36a7 = Sepolia testnet.
 * Extend this set when adding support for other networks.
 */
const ALLOWED_CHAIN_IDS = new Set(["0x1", "0xaa36a7"]);

/** Validate an Ethereum address: 0x followed by exactly 40 hex characters. */
function isValidEthAddress(address: unknown): address is string {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Validate a chainId: must be a hex string like "0x1". */
function isValidChainId(chainId: unknown): chainId is string {
  return typeof chainId === "string" && /^0x[0-9a-fA-F]+$/.test(chainId);
}

/** Wrap a promise with a timeout to prevent indefinite UI hangs. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const defaultState: WalletState = {
  address: null,
  chainId: null,
  walletType: null,
  isConnected: false,
  isConnecting: false,
  isRestoringSession: true,
  error: null,
};

const WalletContext = createContext<WalletContextType>({
  ...defaultState,
  isRestoringSession: false,
  connectMetaMask: async () => {},
  connectPhantom: async () => {},
  connectStellar: async () => {},
  importStellarKey: async () => {},
  fundWithFriendbot: async () => {},
  refreshBalance: async () => {},
  sendXlmPayment: async () => ({ success: false, hash: "" }),
  pendingTransactions: [],
  addPendingTransaction: () => "",
  removePendingTransaction: () => {},
  updatePendingTransaction: () => {},
  disconnect: () => {},
  clearError: () => {},
  balance: null,
  stellarSecret: null,
  stellarMnemonic: null,
});

/**
 * useWallet - Hook to access wallet state and methods
 * 
 * Returns the current wallet context with all state and methods
 * 
 * @returns {WalletContextType} Wallet state and methods
 * 
 * @example
 * const { address, isConnected, connectMetaMask } = useWallet();
 */
export const useWallet = () => useContext(WalletContext);

/** Truncate a wallet address for display: 0x1234...5678 or GABC...XYZ */
export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(defaultState);
  const [balance, setBalance] = useState<string | null>(null);
  const [stellarSecret, setStellarSecret] = useState<string | null>(null);
  const [stellarMnemonic, setStellarMnemonic] = useState<string | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const stateRef = useRef(state);
  const { error: showErrorToast } = useToast();

  const addPendingTransaction = useCallback((tx: Omit<PendingTransaction, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setPendingTransactions((prev) => [{ id, ...tx }, ...prev]);
    return id;
  }, []);

  const removePendingTransaction = useCallback((id: string) => {
    setPendingTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  const updatePendingTransaction = useCallback(
    (id: string, updates: Partial<PendingTransaction>) => {
      setPendingTransactions((prev) =>
        prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx))
      );
    },
    []
  );

  // Sync ref with state so event listeners always see latest values
  // This is necessary because event listeners are set up once and need access to current state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  function persistSession(data: {
    address: string | null;
    chainId: string | null;
    walletType: WalletType | null;
    stellarSecret?: string | null;
    stellarMnemonic?: string | null;
  }) {
    if (data.address) {
      secureStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      secureStorage.removeItem(STORAGE_KEY);
    }
  }

  // Restore persisted session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await secureStorage.getItem(STORAGE_KEY);
        const decryptionWarning = getSecureStorageWarning();
        if (decryptionWarning) {
          showErrorToast(decryptionWarning, 8000);
        }
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.address && parsed.walletType) {
              setState((prev: WalletState) => ({
                ...prev,
                address: parsed.address!,
                chainId: parsed.chainId ?? null,
                walletType: parsed.walletType!,
                isConnected: true,
              }));
              if (parsed.walletType === "stellar") {
                setStellarSecret(parsed.stellarSecret ?? null);
                setStellarMnemonic(parsed.stellarMnemonic ?? null);
              }
            }
          } catch {
            await secureStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        await secureStorage.removeItem(STORAGE_KEY);
      } finally {
        setState((prev: WalletState) => ({ ...prev, isRestoringSession: false }));
      }
    }

    void restoreSession();
  }, [showErrorToast]);

  // Balance updater helper
  const refreshBalance = useCallback(async () => {
    if (state.walletType !== "stellar" || !state.address) return;
    try {
      const bal = await getBalance(state.address);
      setBalance(bal);
    } catch (err: any) {
      console.error("Failed to fetch balance:", err);
    }
  }, [state.address, state.walletType]);

  // Sync balance update on Stellar connection
  useEffect(() => {
    if (state.walletType === "stellar" && state.address) {
      refreshBalance();
      const interval = setInterval(refreshBalance, 8000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
    }
  }, [state.address, state.walletType, refreshBalance]);

  // Listen for MetaMask account / chain changes
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      // Runtime type guard — never trust provider data blindly
      if (!Array.isArray(accounts) || !accounts.every((a) => typeof a === "string")) return;
      const accs = accounts as string[];
      if (accs.length === 0) {
        // User disconnected from MetaMask side
        handleDisconnect();
      } else {
        const address = accs[0];
        setState((prev: WalletState) => ({ ...prev, address }));
        persistSession({ address, chainId: stateRef.current.chainId, walletType: "metamask" });
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      const id = chainId as string;
      setState((prev: WalletState) => ({ ...prev, chainId: id }));
      persistSession({ address: stateRef.current.address, chainId: id, walletType: stateRef.current.walletType });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  /**
   * Listen for Solana/Phantom account changes
   * 
   * Phantom emits events when:
   * - User connects their wallet
   * - User switches accounts
   * - User disconnects from the app
   * 
   * We update state accordingly to keep the UI in sync with wallet state
   */
  useEffect(() => {
    const solana = window.solana;
    if (!solana) return;

    const handleAccountChanged = (publicKey: { toBase58: () => string } | null) => {
      if (!publicKey) {
        handleDisconnect();
      } else {
        const address = publicKey.toBase58();
        setState((prev: WalletState) => ({ ...prev, address }));
        persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
      }
    };

    const handleConnect = (publicKey: { toBase58: () => string }) => {
      const address = publicKey.toBase58();
      setState((prev: WalletState) => ({
        ...prev,
        address,
        isConnected: true,
        isConnecting: false,
        error: null,
      }));
      persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
    };

    solana.on("accountChanged", handleAccountChanged);
    solana.on("connect", handleConnect);

    return () => {
      solana.removeListener("accountChanged", handleAccountChanged);
      solana.removeListener("connect", handleConnect);
    };
  }, []);

  function handleDisconnect() {
    const prevWalletType = stateRef.current.walletType;
    setState({ ...defaultState });
    setBalance(null);
    setStellarSecret(null);
    setStellarMnemonic(null);
    secureStorage.removeItem(STORAGE_KEY);

    // Track disconnect
    if (prevWalletType) {
      analytics.trackWalletDisconnect(prevWalletType);
    }

    // Disconnect from Phantom if connected
    const solana = window.solana;
    if (solana && stateRef.current.walletType === "phantom") {
      solana.disconnect().catch(() => {});
    }
  }

  /**
   * Connect to MetaMask wallet
   * 
   * Flow:
   * 1. Check if MetaMask is installed
   * 2. Request account access from user
   * 3. Get current chain ID
   * 4. Update state with wallet info
   * 5. Persist session to storage
   * 
   * Handles errors:
   * - MetaMask not installed
   * - User rejects connection (code 4001)
   * - No accounts available
   * - Other connection errors
   */
  const connectMetaMask = useCallback(async () => {
    addWalletBreadcrumb("Starting MetaMask connection", "wallet");
    
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      const error = "MetaMask is not installed. Please install the MetaMask browser extension.";
      captureWalletError(new Error(error), "connect_metamask", { walletType: "metamask" });
      setState((prev: WalletState) => ({
        ...prev,
        error,
      }));
      return;
    }

    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request accounts with a 30-second timeout to prevent UI freeze
      const rawAccounts = await withTimeout(
        window.ethereum.request({ method: "eth_requestAccounts" }),
        30_000,
        "eth_requestAccounts"
      );

      // Runtime type guard — never trust the provider blindly
      if (!Array.isArray(rawAccounts) || !rawAccounts.every((a) => typeof a === "string")) {
        throw new Error("Unexpected response from wallet provider.");
      }
      const accounts = rawAccounts as string[];

      if (accounts.length === 0) {
        throw new Error("No accounts returned. Please unlock MetaMask and try again.");
      }

      const address = accounts[0];

      // Validate the address format before storing it
      if (!isValidEthAddress(address)) {
        throw new Error("Wallet returned an invalid address. Please try again.");
      }

      const rawChainId = await withTimeout(
        window.ethereum.request({ method: "eth_chainId" }),
        10_000,
        "eth_chainId"
      );

      if (!isValidChainId(rawChainId)) {
        throw new Error("Unexpected chain ID format from wallet provider.");
      }
      const chainId = rawChainId;

      // Enforce network allowlist
      if (!ALLOWED_CHAIN_IDS.has(chainId)) {
        throw new Error(
          "Unsupported network. Please switch MetaMask to Ethereum Mainnet or Sepolia."
        );
      }

      setState({
        address,
        chainId,
        walletType: "metamask",
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      persistSession({ address, chainId, walletType: "metamask" });
      
      // Track successful wallet connection
      analytics.trackWalletConnect("metamask");
      logWalletOperation("connect_metamask", "success", { walletAddress: address, chainId });
    } catch (err: unknown) {
      const message =
        (err as { code?: number; message?: string })?.code === 4001
          ? "Connection rejected. Please approve the request in MetaMask."
          : (err as Error)?.message ?? "Failed to connect wallet. Please try again.";

      captureWalletError(err, "connect_metamask", { walletType: "metamask", error: message });
      logWalletOperation("connect_metamask", "error", { error: err, walletType: "metamask" });

      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  /**
   * Connect to Phantom wallet (Solana)
   * 
   * Flow:
   * 1. Check if Phantom is installed
   * 2. Request connection from user
   * 3. Get public key and convert to Base58 format
   * 4. Update state with wallet info
   * 5. Persist session to storage
   * 
   * Handles errors:
   * - Phantom not installed
   * - User rejects connection (code 4001)
   * - Other connection errors
   */
  const connectPhantom = useCallback(async () => {
    addWalletBreadcrumb("Starting Phantom connection", "wallet");
    
    const solana = window.solana;
    if (!solana || !solana.isPhantom) {
      const error = "Phantom wallet not detected. Please install the Phantom browser extension.";
      captureWalletError(new Error(error), "connect_phantom", { walletType: "phantom" });
      setState((prev: WalletState) => ({
        ...prev,
        error,
      }));
      return;
    }

    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const response = await solana.connect();
      const address = response.publicKey.toBase58();

      setState({
        address,
        chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h",
        walletType: "phantom",
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
      
      // Track successful wallet connection
      analytics.trackWalletConnect("phantom");
      logWalletOperation("connect_phantom", "success", { walletAddress: address });
    } catch (err: unknown) {
      const message =
        (err as { code?: number; message?: string })?.code === 4001
          ? "Connection rejected. Please approve the request in Phantom."
          : (err as Error)?.message ?? "Failed to connect Phantom wallet. Please try again.";

      captureWalletError(err, "connect_phantom", { walletType: "phantom", error: message });
      logWalletOperation("connect_phantom", "error", { error: err, walletType: "phantom" });

      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  // Connect/Generate Stellar wallet
  const connectStellar = useCallback(async () => {
    addWalletBreadcrumb("Starting Stellar wallet connection", "wallet");
    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const stored = await secureStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.walletType === "stellar" && parsed.stellarSecret) {
          const keypair = StellarSdk.Keypair.fromSecret(parsed.stellarSecret);
          const addr = keypair.publicKey();
          setState({
            address: addr,
            chainId: "stellar",
            walletType: "stellar",
            isConnected: true,
            isConnecting: false,
            error: null,
          });
          setStellarSecret(parsed.stellarSecret);
          setStellarMnemonic(parsed.stellarMnemonic ?? null);
          logWalletOperation("connect_stellar", "success", { walletAddress: addr, network: "stellar" });
          analytics.trackWalletConnect("stellar");
          return;
        }
      }

      const newWallet = await createRandomWallet();
      setState({
        address: newWallet.publicKey,
        chainId: "stellar",
        walletType: "stellar",
        isConnected: true,
        isConnecting: false,
        error: null,
      });
      setStellarSecret(newWallet.secretKey);
      setStellarMnemonic(newWallet.mnemonic);

      persistSession({
        address: newWallet.publicKey,
        chainId: "stellar",
        walletType: "stellar",
        stellarSecret: newWallet.secretKey,
        stellarMnemonic: newWallet.mnemonic,
      });
      logWalletOperation("connect_stellar", "success", { walletAddress: newWallet.publicKey, network: "stellar" });
      analytics.trackWalletCreated("stellar");
    } catch (err: any) {
      captureWalletError(err, "connect_stellar", { walletType: "stellar", error: err.message });
      logWalletOperation("connect_stellar", "error", { error: err, walletType: "stellar" });
      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect/create Stellar wallet",
      }));
    }
  }, []);

  // Import existing Stellar key
  const importStellarKey = useCallback(async (secret: string) => {
    addWalletBreadcrumb("Starting Stellar key import", "wallet");
    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));
    try {
      if (!secret.startsWith("S") || secret.length !== 56) {
        throw new Error("Invalid secret key format. Must be a 56-character string starting with 'S'.");
      }
      const keypair = StellarSdk.Keypair.fromSecret(secret);
      const addr = keypair.publicKey();

      setState({
        address: addr,
        chainId: "stellar",
        walletType: "stellar",
        isConnected: true,
        isConnecting: false,
        error: null,
      });
      setStellarSecret(secret);
      setStellarMnemonic(null); // Imported secret doesn't have a derived mnemonic phrase

      persistSession({
        address: addr,
        chainId: "stellar",
        walletType: "stellar",
        stellarSecret: secret,
        stellarMnemonic: null,
      });
      logWalletOperation("import_stellar_key", "success", { walletAddress: addr, network: "stellar" });
      analytics.trackWalletImport("stellar");
    } catch (err: any) {
      captureWalletError(err, "import_stellar_key", { walletType: "stellar", error: err.message });
      logWalletOperation("import_stellar_key", "error", { error: err, walletType: "stellar" });
      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to import secret key",
      }));
      throw err;
    }
  }, []);

  // Fund Stellar Wallet on Testnet via Friendbot
  const fundWithFriendbotAction = useCallback(async () => {
    if (state.walletType !== "stellar" || !state.address) {
      throw new Error("Stellar wallet not connected");
    }
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      await fundWithFriendbot(state.address);
      // Wait for ledger consensus and refresh balance
      await new Promise((r) => setTimeout(r, 2500));
      await refreshBalance();
      analytics.trackWalletFunded("stellar");
      setState((prev) => ({ ...prev, isConnecting: false }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Friendbot funding failed",
      }));
    }
  }, [state.address, state.walletType, refreshBalance]);

  // Build, sign, and submit an XLM payment
  const sendXlmPayment = useCallback(
    async (destination: string, amount: string) => {
      if (state.walletType !== "stellar" || !stellarSecret || !state.address) {
        throw new Error("Stellar wallet is not connected");
      }

      const pendingId = addPendingTransaction({
        publicKey: state.address,
        type: "sent",
        amount,
        asset: "XLM",
        counterparty: destination,
        timestamp: new Date().toISOString(),
        txHash: "",
        status: "pending",
      });

      try {
        const { transaction } = await buildPaymentTransaction(state.address, destination, amount);
        const senderKeypair = StellarSdk.Keypair.fromSecret(stellarSecret);
        transaction.sign(senderKeypair);
        const result = await submitTransaction(transaction);

        updatePendingTransaction(pendingId, {
          txHash: result.hash,
          status: "pending",
        });

        await refreshBalance();
        analytics.trackTransaction({
          walletType: "stellar",
          assetCode: "XLM",
          amountBucket: bucketAmount(parseFloat(amount)),
          network: "stellar",
        });
        return { success: true, hash: result.hash };
      } catch (err: any) {
        removePendingTransaction(pendingId);
        console.error("XLM Payment execution failed:", err);
        throw err;
      }
    },
    [state.address, state.walletType, stellarSecret, refreshBalance, addPendingTransaction, removePendingTransaction, updatePendingTransaction]
  );

  const disconnect = useCallback(() => {
    handleDisconnect();
  }, [state.walletType]);

  /**
   * Clear any error messages
   * 
   * Useful for dismissing error notifications
   */
  const clearError = useCallback(() => {
    setState((prev: WalletState) => ({ ...prev, error: null }));
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        balance,
        stellarSecret,
        stellarMnemonic,
        connectMetaMask,
        connectPhantom,
        connectStellar,
        importStellarKey,
        fundWithFriendbot: fundWithFriendbotAction,
        refreshBalance,
        sendXlmPayment,
        pendingTransactions,
        addPendingTransaction,
        removePendingTransaction,
        updatePendingTransaction,
        disconnect,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
