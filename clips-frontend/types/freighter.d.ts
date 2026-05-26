/**
 * Type definitions for Freighter Wallet
 * https://www.freighter.app/
 */

declare global {
  interface Window {
    /**
     * Freighter wallet API injected into the browser window
     */
    freighter?: FreighterAPI;
  }
}

/**
 * Freighter Wallet API
 */
export interface FreighterAPI {
  /**
   * Check if Freighter is connected to the current site
   */
  isConnected(): Promise<boolean>;

  /**
   * Get the user's public key (Stellar address)
   * This will prompt the user to grant access if not already granted
   */
  getPublicKey(): Promise<string>;

  /**
   * Get the current network the user has selected in Freighter
   * @returns "PUBLIC" for mainnet, "TESTNET" for testnet
   */
  getNetwork(): Promise<"PUBLIC" | "TESTNET">;

  /**
   * Get the network passphrase for the current network
   */
  getNetworkDetails(): Promise<{
    network: string;
    networkPassphrase: string;
    networkUrl: string;
  }>;

  /**
   * Sign a transaction XDR with the user's key
   * @param xdr - The transaction XDR string to sign
   * @param options - Signing options
   * @returns The signed transaction XDR
   */
  signTransaction(
    xdr: string,
    options?: SignTransactionOptions
  ): Promise<string>;

  /**
   * Sign an authorization entry (for Soroban)
   * @param entryXdr - The authorization entry XDR
   * @param options - Signing options
   * @returns The signed authorization entry XDR
   */
  signAuthEntry(
    entryXdr: string,
    options?: SignAuthEntryOptions
  ): Promise<string>;

  /**
   * Sign arbitrary data (for authentication, etc.)
   * @param data - The data to sign (as a string or Buffer)
   * @returns The signature
   */
  signMessage(data: string | Buffer): Promise<string>;
}

/**
 * Options for signing a transaction
 */
export interface SignTransactionOptions {
  /**
   * The network to use for signing
   * "TESTNET" or "PUBLIC" (mainnet)
   */
  network?: string;

  /**
   * The network passphrase
   * If not provided, Freighter will use the default for the network
   */
  networkPassphrase?: string;

  /**
   * The account to sign with (if user has multiple accounts)
   * If not provided, uses the currently selected account
   */
  accountToSign?: string;
}

/**
 * Options for signing an authorization entry
 */
export interface SignAuthEntryOptions {
  /**
   * The public key of the account to sign with
   */
  accountToSign?: string;
}

/**
 * Freighter error codes
 */
export enum FreighterErrorCode {
  USER_DECLINED = "USER_DECLINED_ACCESS",
  NOT_INSTALLED = "FREIGHTER_NOT_AVAILABLE",
  INVALID_XDR = "INVALID_XDR",
  NETWORK_MISMATCH = "NETWORK_MISMATCH",
}

/**
 * Error thrown by Freighter
 */
export class FreighterError extends Error {
  code: FreighterErrorCode;
  constructor(message: string, code: FreighterErrorCode);
}

export {};
