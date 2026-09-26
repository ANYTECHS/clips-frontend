import type { StellarNetwork } from "./networkConfig";

/**
 * User Preferences Storage
 * 
 * This module handles non-sensitive user preferences stored in localStorage.
 * Keys here do not need encryption (e.g., via secureStorage) because they 
 * do not contain sensitive user data (like private keys or auth tokens).
 */

const NETWORK_OVERRIDE_KEY = "clipcash_network_override";

/**
 * Typed storage helper for the non-sensitive runtime network preference.
 *
 * This key only stores the selected Stellar network (`mainnet` | `testnet`),
 * which is public configuration and not user-secret material. Encryption via
 * secure storage is intentionally not required for this value.
 */
export const NetworkPreferenceStorage = {
  /**
   * Retrieves the user's preferred network override.
   * Not encrypted because network preference is not sensitive data.
   */
  get: (): StellarNetwork | null => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(NETWORK_OVERRIDE_KEY);
    if (stored === "mainnet" || stored === "testnet") {
      return stored as StellarNetwork;
    }
    return null;
  },

  /**
   * Saves the user's preferred network override.
   * Not encrypted because network preference is not sensitive data.
   */
  set: (network: StellarNetwork): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem(NETWORK_OVERRIDE_KEY, network);
    }
  },

  /**
   * Gets the raw storage key for use in event listeners.
   */
  getKey: (): string => NETWORK_OVERRIDE_KEY,
};
