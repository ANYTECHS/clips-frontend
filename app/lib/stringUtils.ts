/**
 * String Utility Functions
 *
 * Common string manipulation utilities for addresses, IDs, and other text.
 */

/**
 * Truncate a string to show first N and last M characters with ellipsis.
 * Commonly used for wallet addresses, transaction IDs, etc.
 *
 * @param str - The string to truncate
 * @param startLength - Number of characters to show at the beginning. Default: 6
 * @param endLength - Number of characters to show at the end. Default: 4
 * @param minLength - Minimum length before truncation is applied. Default: 12
 * @returns Truncated string with ellipsis, or original string if too short
 *
 * @example
 * truncateAddress("GABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU")
 * // Returns: "GABC12...678STU"
 *
 * @example
 * truncateAddress("0x1234567890123456789012345678901234567890")
 * // Returns: "0x1234...7890"
 *
 * @example
 * truncateAddress("short")
 * // Returns: "short" (too short to truncate)
 */
export function truncateAddress(
  str: string,
  startLength: number = 6,
  endLength: number = 4,
  minLength: number = 12
): string {
  if (str.length <= minLength) return str;
  return `${str.slice(0, startLength)}...${str.slice(-endLength)}`;
}

/**
 * Truncate a Stellar public key address.
 * Stellar addresses are 56 characters (G + 55 base32 characters).
 *
 * @param publicKey - Stellar public key to truncate
 * @returns Truncated address or original if too short
 *
 * @example
 * truncateStellarAddress("GABC123XYZ789DEF456GHI789JKL012MNO345PQR678STU")
 * // Returns: "GABC12...678STU"
 */
export function truncateStellarAddress(publicKey: string): string {
  return truncateAddress(publicKey, 6, 4, 10);
}
