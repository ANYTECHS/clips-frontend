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
 * NEXT_PUBLIC_STELLAR_NETWORK   - "testnet" (default) | "mainnet"
 * NEXT_PUBLIC_STELLAR_RPC       - Optional custom Soroban RPC URL override
 */

/**
 * Valid operational ecosystem tier identifiers.
 */
export type StellarNetwork = "testnet" | "mainnet";

/** Normalised network value derived from the environment variable. */
const _envNetwork: StellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

/**
 * Return the active Stellar network. Reads `localStorage.clipcash_network_override`
 * on every invocation so callers always get the current runtime override.
 * Safe for SSR: returns the env-derived default when `window` is undefined.
 *
 * @returns The active evaluated network tier string value.
 */
export function getStellarNetwork(): StellarNetwork {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("clipcash_network_override");
    if (stored === "testnet" || stored === "mainnet") return stored;
  }
  return _envNetwork;
}

/**
 * Whether the app is currently running against mainnet. Evaluated on demand.
 *
 * @returns True if active environment evaluates cleanly to mainnet.
 */
export function isMainnet(): boolean {
  return getStellarNetwork() === "mainnet";
}

/**
 * Whether the app is currently running against testnet. Evaluated on demand.
 *
 * @returns True if active environment evaluates cleanly to testnet.
 */
export function isTestnet(): boolean {
  return getStellarNetwork() === "testnet";
}

/**
 * Specification mapping core infrastructure parameters describing a target blockchain target context.
 */
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
  /** Soroban NFT contract address */
  nftContractId?: string;
}

/**
 * Static schema config parameters supporting testnet and mainnet entry points.
 */
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
    nftContractId: process.env.NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID,
  },
  mainnet: {
    label: "Mainnet",
    horizonUrl: "https://horizon.stellar.org",
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC || "https://soroban.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    friendbotUrl: null,
    freighterNetwork: "PUBLIC",
    nftContractId: process.env.NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID_MAINNET,
  },
};

/**
 * Returns the active network configuration (horizon/rpc/passphrase, etc.)
 * computed at call time based on the current `getStellarNetwork()` value.
 *
 * @returns Config context mapping pointing to active operational parameters.
 */
export function getActiveNetworkConfig(): StellarNetworkConfig {
  return NETWORK_CONFIGS[getStellarNetwork()];
}

/**
 * Returns the Horizon URL for the active network.
 * Convenience helper so callers don't need to import the full config object.
 *
 * @param network - Optional target network context descriptor string override.
 * @returns Complete target endpoint URL destination string.
 */
export function getHorizonUrl(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? getStellarNetwork()].horizonUrl;
}

/**
 * Returns the Soroban RPC URL for the active network.
 *
 * @param network - Optional target network context descriptor string override.
 * @returns Target Soroban node operational endpoint address string.
 */
export function getRpcUrl(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? getStellarNetwork()].rpcUrl;
}

/**
 * Returns the network passphrase for the active network.
 *
 * @param network - Optional target network context descriptor string override.
 * @returns Cryptographic salt signature identifier passphrase string.
 */
export function getNetworkPassphrase(network?: StellarNetwork): string {
  return NETWORK_CONFIGS[network ?? getStellarNetwork()].networkPassphrase;
}

/**
 * Returns the Friendbot URL for testnet, or null on mainnet.
 * Throws if called with mainnet to prevent accidental usage.
 *
 * @param network - Optional target network context descriptor string override.
 * @returns Dedicated friendbot activation address route path string.
 * @throws {Error} If evaluated target network points directly to mainnet parameters.
 */
export function getFriendbotUrl(network?: StellarNetwork): string {
  const cfg = NETWORK_CONFIGS[network ?? getStellarNetwork()];
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
 *
 * @param network - Optional target network context descriptor string override.
 * @returns Injected extension wallet network reference token designation.
 */
export function getFreighterNetwork(network?: StellarNetwork): "PUBLIC" | "TESTNET" {
  return NETWORK_CONFIGS[network ?? getStellarNetwork()].freighterNetwork;
}

/**
 * Returns the Stellar Laboratory URL for a specific transaction.
 *
 * @param txHash - The transaction hash to view.
 * @param network - Optional network override configuration target.
 * @returns Explorer tracking URL pointing directly into sandbox vectors.
 */
export function getStellarLabUrl(txHash: string, network?: StellarNetwork): string {
  const freighterNetwork = getFreighterNetwork(network).toLowerCase();
  const labNetwork = freighterNetwork === "public" ? "public" : "test";
  return `https://laboratory.stellar.org/#explorer?resource=transactions&endpoint=single&values=${txHash}&network=${labNetwork}`;
}

/**
 * Returns the NFT contract address for the active network.
 *
 * @param network - Optional network override configuration target.
 * @returns The hex/address string configuration key entry pointer, if mapped.
 */
export function getNftContractId(network?: StellarNetwork): string | undefined {
  return NETWORK_CONFIGS[network ?? getStellarNetwork()].nftContractId;
}

/**
 * Helper generating base asset string routes across Stellar Expert indexing platforms.
 *
 * @param network - Target network indicator parameter tracking environment paths.
 * @returns Root domain addressing layout string.
 */
function getStellarExpertBaseUrl(network?: StellarNetwork) {
  return network === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";
}

/**
 * Helper generating base asset string routes across StellarScan indexing platforms.
 *
 * @param network - Target network indicator parameter tracking environment paths.
 * @returns Root domain addressing layout string.
 */
function getStellarScanBaseUrl(network?: StellarNetwork) {
  return network === "mainnet"
    ? "https://stellarscan.io"
    : "https://testnet.stellarscan.io";
}

/**
 * Appends localized account identities to active Stellar Expert block explorer links.
 *
 * @param accountId - Target public cryptographic signing ledger string vector.
 * @param network - Optional environment context indicator parameter tracking configurations.
 * @returns Complete explorer profile location address reference string.
 */
export function getStellarExpertAccountUrl(accountId: string, network?: StellarNetwork): string {
  return `${getStellarExpertBaseUrl(network)}/account/${encodeURIComponent(accountId)}`;
}

/**
 * Appends transaction signatures to active Stellar Expert block explorer links.
 *
 * @param txHash - Unique on-chain mutation hash value identifying target operation instances.
 * @param network - Optional environment context indicator parameter tracking configurations.
 * @returns Complete transaction history lookup location address reference string.
 */
export function getStellarExpertTransactionUrl(txHash: string, network?: StellarNetwork): string {
  return `${getStellarExpertBaseUrl(network)}/tx/${encodeURIComponent(txHash)}`;
}

/**
 * Appends localized account identities to active StellarScan block explorer links.
 *
 * @param accountId - Target public cryptographic signing ledger string vector.
 * @param network - Optional environment context indicator parameter tracking configurations.
 * @returns Complete explorer profile location address reference string.
 */
export function getStellarScanAccountUrl(accountId: string, network?: StellarNetwork): string {
  return `${getStellarScanBaseUrl(network)}/account/${encodeURIComponent(accountId)}`;
}

/**
 * Appends transaction signatures to active StellarScan block explorer links.
 *
 * @param txHash - Unique on-chain mutation hash value identifying target operation instances.
 * @param network - Optional environment context indicator parameter tracking configurations.
 * @returns Complete transaction history lookup location address reference string.
 */
export function getStellarScanTransactionUrl(txHash: string, network?: StellarNetwork): string {
  return `${getStellarScanBaseUrl(network)}/tx/${encodeURIComponent(txHash)}`;
}
