"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { VALIDATION_MESSAGES } from "@/app/lib/errorMessages";
import {
  MultiWalletRecord,
  MultiWalletStorage,
  WalletProviderType,
} from "@/app/lib/multiWalletStorage";
import {
  addConnectedWallet,
  defaultStellarWalletConnectors,
  disconnectWallet as disconnectFromState,
  EMPTY_MULTI_WALLET_STATE,
  getActiveWallet as findActiveWallet,
  setActiveWallet as selectActiveWallet,
  type ConnectedWallet,
  type MultiWalletState,
  type SignOptions,
  type StellarWalletConnectors,
  type StellarWalletType,
} from "@/app/lib/multiWalletState";
import { useAuth } from "@/components/auth/AuthProvider";

// Analytics is optional — import lazily to avoid breaking tests that don't mock it
let analytics: { trackEvent: (name: string, props?: Record<string, unknown>) => void } | null =
  null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  analytics = require("@/lib/analytics").default;
} catch {}

interface MultiWalletContextValue {
  wallets: MultiWalletRecord[];
  activeWallet: MultiWalletRecord | null;
  primaryWallet: MultiWalletRecord | null;
  isOperating: boolean;
  error: string | null;
  addWallet: (
    data: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
  ) => Promise<MultiWalletRecord>;
  removeWallet: (walletId: string) => void;
  switchWallet: (walletId: string) => void;
  setPrimaryWallet: (walletId: string) => void;
  updateWallet: (walletId: string, updates: Partial<MultiWalletRecord>) => void;
  refreshWallets: () => void;
  clearError: () => void;

  // ── Connected Stellar wallets (#1219) ──
  /** Every connected Stellar wallet (Freighter, Albedo, xBull, passkey). */
  connectedWallets: ConnectedWallet[];
  /** Id of the wallet used for transaction signing. */
  activeWalletId: string | null;
  /** Connect a wallet; reconnecting an already connected public key is a no-op. */
  connectWallet: (type: StellarWalletType) => Promise<ConnectedWallet>;
  /** Disconnect a wallet; the next connected wallet becomes active, or none. */
  disconnectWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  getActiveWallet: () => ConnectedWallet | null;
  /** Sign with the active wallet's own connection. */
  signTransaction: (xdr: string, options: SignOptions) => Promise<string>;
}

const CONNECTED_WALLETS_PREFIX = "clipcash_connected_wallets_";

function loadConnectionState(userId: string): MultiWalletState {
  if (typeof window === "undefined") return EMPTY_MULTI_WALLET_STATE;
  try {
    const raw = localStorage.getItem(`${CONNECTED_WALLETS_PREFIX}${userId}`);
    if (!raw) return EMPTY_MULTI_WALLET_STATE;
    const parsed = JSON.parse(raw) as MultiWalletState;
    return Array.isArray(parsed?.wallets) ? parsed : EMPTY_MULTI_WALLET_STATE;
  } catch {
    return EMPTY_MULTI_WALLET_STATE;
  }
}

function persistConnectionState(userId: string, state: MultiWalletState): void {
  if (typeof window === "undefined") return;
  try {
    // Public keys and labels only — no secrets are part of this state.
    localStorage.setItem(`${CONNECTED_WALLETS_PREFIX}${userId}`, JSON.stringify(state));
  } catch {
    // Non-critical: the in-memory state remains correct for this session.
  }
}

const MultiWalletContext = createContext<MultiWalletContextValue | null>(null);
MultiWalletContext.displayName = "MultiWalletContext";

export function MultiWalletProvider({
  children,
  connectors,
}: {
  children: React.ReactNode;
  /** Override wallet adapters, e.g. in tests or Storybook. */
  connectors?: Partial<StellarWalletConnectors>;
}) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<MultiWalletRecord[]>([]);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<MultiWalletState>(EMPTY_MULTI_WALLET_STATE);
  // Mirrors connectionState so async actions always see the latest value.
  const connectionStateRef = useRef<MultiWalletState>(EMPTY_MULTI_WALLET_STATE);

  const connectorsRef = useRef<StellarWalletConnectors>(defaultStellarWalletConnectors);
  connectorsRef.current = { ...defaultStellarWalletConnectors, ...connectors };

  const updateConnectionState = useCallback(
    (next: MultiWalletState) => {
      if (next === connectionStateRef.current) return;
      connectionStateRef.current = next;
      setConnectionState(next);
      if (user?.id) persistConnectionState(user.id, next);
    },
    [user?.id]
  );

  useEffect(() => {
    const initial = user?.id ? loadConnectionState(user.id) : EMPTY_MULTI_WALLET_STATE;
    connectionStateRef.current = initial;
    setConnectionState(initial);
  }, [user?.id]);

  const loadWallets = useCallback(() => {
    if (!user?.id) {
      setWallets([]);
      return;
    }
    setWallets(MultiWalletStorage.getAll(user.id));
  }, [user?.id]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const activeWallet = wallets.find((w) => w.isActive) ?? null;
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? null;

  const addWallet = useCallback(
    async (
      data: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
    ): Promise<MultiWalletRecord> => {
      if (!user?.id) throw new Error("User not authenticated");
      setIsOperating(true);
      try {
        const record = MultiWalletStorage.addWallet(user.id, data);
        setWallets(MultiWalletStorage.getAll(user.id));
        analytics?.trackEvent("wallet_added", { wallet_type: data.walletType });
        return record;
      } catch (err: any) {
        const msg = err?.message ?? "Failed to add wallet";
        setError(msg);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [user?.id]
  );

  const removeWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      const target = wallets.find((w) => w.id === walletId);
      if (target?.isPrimary) {
        setError(VALIDATION_MESSAGES.primaryWalletRequired);
        return;
      }
      MultiWalletStorage.removeWallet(user.id, walletId);
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id, wallets]
  );

  const switchWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      MultiWalletStorage.setActiveWallet(user.id, walletId);
      setWallets(MultiWalletStorage.getAll(user.id));
      analytics?.trackEvent("wallet_switched", { wallet_id: walletId });
    },
    [user?.id]
  );

  const setPrimaryWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      MultiWalletStorage.updateWallet(user.id, walletId, { isPrimary: true });
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id]
  );

  const updateWallet = useCallback(
    (walletId: string, updates: Partial<MultiWalletRecord>) => {
      if (!user?.id) return;
      MultiWalletStorage.updateWallet(user.id, walletId, updates);
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id]
  );

  const refreshWallets = useCallback(() => {
    loadWallets();
  }, [loadWallets]);

  const clearError = useCallback(() => setError(null), []);

  const connectWallet = useCallback(
    async (type: StellarWalletType): Promise<ConnectedWallet> => {
      setIsOperating(true);
      setError(null);
      try {
        const { publicKey } = await connectorsRef.current[type].connect();
        const next = addConnectedWallet(connectionStateRef.current, { type, publicKey });
        updateConnectionState(next);
        analytics?.trackEvent("wallet_connected", { wallet_type: type });
        return next.wallets.find((w) => w.publicKey === publicKey)!;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect wallet");
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [updateConnectionState]
  );

  const disconnectWallet = useCallback(
    (id: string) => {
      updateConnectionState(disconnectFromState(connectionStateRef.current, id));
    },
    [updateConnectionState]
  );

  const setActiveWallet = useCallback(
    (id: string) => {
      updateConnectionState(selectActiveWallet(connectionStateRef.current, id));
    },
    [updateConnectionState]
  );

  const getActiveWallet = useCallback(
    () => findActiveWallet(connectionStateRef.current),
    []
  );

  const signTransaction = useCallback(
    async (xdr: string, options: SignOptions): Promise<string> => {
      const active = findActiveWallet(connectionStateRef.current);
      if (!active) throw new Error("No active wallet selected");
      return connectorsRef.current[active.type].signTransaction(xdr, active.publicKey, options);
    },
    []
  );

  return (
    <MultiWalletContext.Provider
      value={{
        wallets,
        activeWallet,
        primaryWallet,
        isOperating,
        error,
        addWallet,
        removeWallet,
        switchWallet,
        setPrimaryWallet,
        updateWallet,
        refreshWallets,
        clearError,
        connectedWallets: connectionState.wallets,
        activeWalletId: connectionState.activeWalletId,
        connectWallet,
        disconnectWallet,
        setActiveWallet,
        getActiveWallet,
        signTransaction,
      }}
    >
      {children}
    </MultiWalletContext.Provider>
  );
}

export function useMultiWallet(): MultiWalletContextValue {
  const ctx = useContext(MultiWalletContext);
  if (!ctx) throw new Error("useMultiWallet must be used inside <MultiWalletProvider>");
  return ctx;
}

/**
 * One-time migration from single-wallet to multi-wallet storage.
 * No-op if the user already has wallets.
 */
export function migrateToMultiWallet(
  userId: string,
  data: {
    publicKey: string;
    secretKey?: string;
    walletType: WalletProviderType;
    network?: "testnet" | "mainnet";
    chainId?: string;
  }
): void {
  MultiWalletStorage.migrateFromSingleWallet(userId, data);
}
