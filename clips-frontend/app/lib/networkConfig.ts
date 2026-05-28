/**
 * networkConfig.ts
 *
 * Single source of truth for Stellar network configuration.
 *
 * Set NEXT_PUBLIC_STELLAR_NETWORK to "mainnet" or "testnet" in your .env file.
 * All wallet hooks and utilities read from this module — never hardcode the
 * network string in individual files.
 *
 * Environment variables:
 *   NEXT_PUBLIC_STELLAR_NETWORK   - "testnet" (default) | "mainnet"
 *   NEXT_PUBLIC_STELLAR_RPC       - Optional custom Soroban RPC URL override
 */

export type StellarNetwork = "testnet" | "mainnet";

/** Normalised network value derived from the environment variable. */
export const STELLAR_NETWORK: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

/** Whether the app is currently running against mainnet. */
export const IS_MAINNET = STELLAR_NETWORK === "mainnet";

/** Whether the app is currently running against testnet. */
export const IS_TESTNET = STELLAR_NETWORK === "testnet";

export interface StellarNetworkConfig {
  /** Human-readable label */
  label: string;
  /** Horizon REST API base URL */
  horizonUrl: string;
  /** Soroban RPC URL */
  rpcUrl: string;
  /** Stellar network passphrase used when signing transactions */
  networkPassphrase: string;
  /** Friendbot funding URL — null on mainnet */
  friendbotUrl: string | null;
  /** Horizon network identifier used by Freighter ("PUBLIC" | "TESTNET") */
  freighterNetwork: "PUBLIC" | "TESTNET";
}

export const NETWORK_CONFIGS: Record<StellarNetwork, StellarNetworkConfig> = {
  testnet: {
    label: "Testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC ||
      "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org",
    freighterNetwork: "TESTNET",
  },
  mainnet: {
    label: "Mainnet",
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC || "https://soroban.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    friendbotUrl: null, // Friendbot is not available on mainnet
    freighterNetwork: "PUBLIC",
  },
};

/** Active network configuration derived from the environment. */
export const ACTIVE_NETWORK_CONFIG: StellarNetworkConfig =
  NETWORK_CONFIGS[STELLAR_NETWORK];

/**
 * Returns the Horizon URL for the active network.
 * Convenience helper so callers don't need to import the full config object.
 */
export function getHorizonUrl(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? STELLAR_NETWORK].horizonUrl;
}

/**
 * Returns the Soroban RPC URL for the active network.
 */
export function getRpcUrl(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? STELLAR_NETWORK].rpcUrl;
}

/**
 * Returns the network passphrase for the active network.
 */
export function getNetworkPassphrase(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? STELLAR_NETWORK].networkPassphrase;
}

/**
 * Returns the Friendbot URL for testnet, or null on mainnet.
 * Throws if called with mainnet to prevent accidental usage.
 */
export function getFriendbotUrl(network?: StellarNetwork): string {
  const cfg = NETWORK_CONFIGS[network ?? STELLAR_NETWORK];
  if (!cfg.friendbotUrl) {
    throw new Error(
      `Friendbot is not available on ${cfg.label}. ` +
        "Use a server-side sponsorship transaction to activate mainnet accounts."
    );
  }
  return cfg.friendbotUrl;
}

/**
 * Returns the Freighter-compatible network identifier ("PUBLIC" | "TESTNET").
 */
export function getFreighterNetwork(network?: StellarNetwork): "PUBLIC" | "TESTNET" {
  return NETWORK_CONFIGS[network ?? STELLAR_NETWORK].freighterNetwork;
}

/**
 * Returns the Stellar Laboratory URL for a specific transaction.
 * @param txHash The transaction hash to view
 * @param network Optional network override
 */
export function getStellarLabUrl(txHash: string, network?: StellarNetwork): string {
  const freighterNetwork = getFreighterNetwork(network).toLowerCase();
  const labNetwork = freighterNetwork === "public" ? "public" : "test";
  return `https://laboratory.stellar.org/#explorer?resource=transactions&endpoint=single&values=${txHash}&network=${labNetwork}`;
}
