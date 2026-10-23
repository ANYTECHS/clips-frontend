/**
 * multiWalletState.ts — Issue #1219
 *
 * Connection state for multiple simultaneously connected Stellar wallets
 * (Freighter, Albedo, xBull, passkey) and the adapters used to connect to
 * and sign with each of them.
 *
 * The state functions are pure: they take the current state and return the
 * next one, so the rules (deduplication, active-wallet fallback) are easy to
 * test and identical wherever they are used.
 */

export type StellarWalletType = "freighter" | "albedo" | "xbull" | "passkey";

export const STELLAR_WALLET_TYPES: readonly StellarWalletType[] = [
  "freighter",
  "albedo",
  "xbull",
  "passkey",
];

export const STELLAR_WALLET_LABELS: Record<StellarWalletType, string> = {
  freighter: "Freighter",
  albedo: "Albedo",
  xbull: "xBull",
  passkey: "Passkey",
};

export interface ConnectedWallet {
  id: string;
  type: StellarWalletType;
  publicKey: string;
  label: string;
  isConnected: boolean;
}

export interface MultiWalletState {
  wallets: ConnectedWallet[];
  /** Wallet used for transaction signing, or null when none is connected. */
  activeWalletId: string | null;
}

export const EMPTY_MULTI_WALLET_STATE: MultiWalletState = {
  wallets: [],
  activeWalletId: null,
};

function generateConnectionId(type: StellarWalletType): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return `${type}_${random}`;
}

/**
 * Add a connected wallet. Connecting a public key that is already connected
 * is a no-op and returns the same state object. A newly connected wallet
 * becomes active only when no wallet is active yet.
 */
export function addConnectedWallet(
  state: MultiWalletState,
  connection: { type: StellarWalletType; publicKey: string; label?: string },
  id: string = generateConnectionId(connection.type),
): MultiWalletState {
  const existing = state.wallets.find((w) => w.publicKey === connection.publicKey);

  if (existing?.isConnected) return state;

  if (existing) {
    // Previously disconnected — reconnect it in place.
    const wallets = state.wallets.map((w) =>
      w.id === existing.id ? { ...w, type: connection.type, isConnected: true } : w,
    );
    return { wallets, activeWalletId: state.activeWalletId ?? existing.id };
  }

  const wallet: ConnectedWallet = {
    id,
    type: connection.type,
    publicKey: connection.publicKey,
    label: connection.label ?? STELLAR_WALLET_LABELS[connection.type],
    isConnected: true,
  };
  return {
    wallets: [...state.wallets, wallet],
    activeWalletId: state.activeWalletId ?? wallet.id,
  };
}

/**
 * Disconnect a wallet. When it was the active wallet, the next connected
 * wallet in list order (wrapping around) becomes active, or none.
 */
export function disconnectWallet(state: MultiWalletState, id: string): MultiWalletState {
  const index = state.wallets.findIndex((w) => w.id === id);
  if (index === -1) return state;

  const wallets = state.wallets.filter((w) => w.id !== id);
  if (state.activeWalletId !== id) {
    return { ...state, wallets };
  }

  const ordered = [...wallets.slice(index), ...wallets.slice(0, index)];
  const next = ordered.find((w) => w.isConnected) ?? null;
  return { wallets, activeWalletId: next?.id ?? null };
}

/** Select a wallet for transactions. Ignored for unknown or disconnected wallets. */
export function setActiveWallet(state: MultiWalletState, id: string): MultiWalletState {
  const target = state.wallets.find((w) => w.id === id);
  if (!target?.isConnected || state.activeWalletId === id) return state;
  return { ...state, activeWalletId: id };
}

export function getActiveWallet(state: MultiWalletState): ConnectedWallet | null {
  return (
    state.wallets.find((w) => w.id === state.activeWalletId && w.isConnected) ?? null
  );
}

// ─── Wallet adapters ─────────────────────────────────────────────────────────

export interface SignOptions {
  networkPassphrase: string;
}

/** Connects to and signs with one kind of Stellar wallet. */
export interface StellarWalletConnector {
  connect(): Promise<{ publicKey: string }>;
  signTransaction(xdr: string, publicKey: string, options: SignOptions): Promise<string>;
}

export type StellarWalletConnectors = Record<StellarWalletType, StellarWalletConnector>;

type InjectedWindow = Window & {
  freighter?: {
    getPublicKey(): Promise<string | { publicKey: string }>;
    signTransaction(
      xdr: string,
      opts: { networkPassphrase: string; accountToSign: string },
    ): Promise<string | { signedTxXdr: string }>;
  };
  albedo?: {
    publicKey(opts?: object): Promise<{ pubkey: string }>;
    tx(opts: { xdr: string; pubkey: string; network_passphrase: string }): Promise<{
      signed_envelope_xdr: string;
    }>;
  };
  xBullSDK?: {
    connect(opts?: object): Promise<unknown>;
    getPublicKey(): Promise<string>;
    signXDR(xdr: string, opts: { publicKey: string; network: string }): Promise<string>;
  };
};

function injected(): InjectedWindow {
  if (typeof window === "undefined") {
    throw new Error("Wallet connections are only available in the browser");
  }
  return window as InjectedWindow;
}

function requireExtension<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`${name} is not available. Please install or enable it.`);
  return value;
}

const freighterConnector: StellarWalletConnector = {
  async connect() {
    const freighter = requireExtension(injected().freighter, "Freighter");
    const result = await freighter.getPublicKey();
    const publicKey = typeof result === "string" ? result : result?.publicKey;
    if (!publicKey) throw new Error("Freighter did not return a public key");
    return { publicKey };
  },
  async signTransaction(xdr, publicKey, { networkPassphrase }) {
    const freighter = requireExtension(injected().freighter, "Freighter");
    const result = await freighter.signTransaction(xdr, {
      networkPassphrase,
      accountToSign: publicKey,
    });
    return typeof result === "string" ? result : result.signedTxXdr;
  },
};

const albedoConnector: StellarWalletConnector = {
  async connect() {
    const albedo = requireExtension(injected().albedo, "Albedo");
    const { pubkey } = await albedo.publicKey({});
    return { publicKey: pubkey };
  },
  async signTransaction(xdr, publicKey, { networkPassphrase }) {
    const albedo = requireExtension(injected().albedo, "Albedo");
    const result = await albedo.tx({ xdr, pubkey: publicKey, network_passphrase: networkPassphrase });
    return result.signed_envelope_xdr;
  },
};

const xbullConnector: StellarWalletConnector = {
  async connect() {
    const xbull = requireExtension(injected().xBullSDK, "xBull");
    await xbull.connect({ canRequestPublicKey: true, canRequestSign: true });
    return { publicKey: await xbull.getPublicKey() };
  },
  async signTransaction(xdr, publicKey, { networkPassphrase }) {
    const xbull = requireExtension(injected().xBullSDK, "xBull");
    return xbull.signXDR(xdr, { publicKey, network: networkPassphrase });
  },
};

const passkeyConnector: StellarWalletConnector = {
  async connect() {
    const { startAuthentication } = await import("@simplewebauthn/browser");
    const optRes = await fetch("/api/auth/passkey/authenticate", {
      headers: { Accept: "application/json" },
    });
    if (!optRes.ok) throw new Error("Failed to fetch passkey authentication options.");
    const authResponse = await startAuthentication(await optRes.json());
    const verifyRes = await fetch("/api/auth/passkey/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authResponse),
    });
    if (!verifyRes.ok) throw new Error("Failed to verify passkey authentication.");
    const { publicKey } = (await verifyRes.json()) as { publicKey?: string };
    if (!publicKey) throw new Error("Passkey wallet has no public key");
    return { publicKey };
  },
  async signTransaction() {
    // Passkey accounts are Soroban smart wallets; classic envelope signing
    // is not possible with a WebAuthn credential.
    throw new Error("Passkey wallets cannot sign classic Stellar transactions yet");
  },
};

export const defaultStellarWalletConnectors: StellarWalletConnectors = {
  freighter: freighterConnector,
  albedo: albedoConnector,
  xbull: xbullConnector,
  passkey: passkeyConnector,
};
