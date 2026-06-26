import secrets from "secrets.js-grempe";

const BITS = 8;

/**
 * Converts a raw string secret into a hexadecimal string representations required by the underlying cryptographic engine.
 *
 * @param secret - The raw plaintext secret string to be converted.
 * @returns A continuous hexadecimal string representation of the input text character code sequences.
 */
function toHex(secret: string): string {
  return Array.from(secret, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Reverts a validated hexadecimal string back into its original raw character string presentation framework.
 *
 * @param hex - A continuous sequence of hexadecimal pair bytes.
 * @returns The reconstructed plaintext ASCII or UTF character string.
 */
function fromHex(hex: string): string {
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    chars.push(String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)));
  }
  return chars.join("");
}

/**
 * Configuration options detailing execution constraints for Shamir's Secret Sharing polynomial splittings.
 */
export type ShamirSplitOptions = {
  /** Total number of unique shard pieces to generate from the primary secret asset. */
  shares: number;
  /** The minimum quorum quantity of distinct shares required to successfully reconstruct the source data string. */
  threshold: number;
};

/**
 * Splits a raw secret string into an array of cryptographic hexadecimal shares using Shamir's Secret Sharing scheme.
 *
 * @param secret - The core sensitive credentials passphrase string to fractionally distribute.
 * @param options - Structuring constraints detailing target share counts and quorum boundaries.
 * @returns An array of cryptographically isolated hexadecimal shard pieces.
 * @throws {Error} Thrown if the recovery threshold is less than 2, or if total shares are less than the quorum threshold.
 * @example
 * ```typescript
 * const shares = splitSecret("my_secret_key", { shares: 5, threshold: 3 });
 * ```
 */
export function splitSecret(
  secret: string,
  options: ShamirSplitOptions
): string[] {
  const { shares, threshold } = options;
  if (threshold < 2) {
    throw new Error("Recovery threshold must be at least 2.");
  }
  if (shares < threshold) {
    throw new Error("Number of guardians must be at least the recovery threshold.");
  }

  secrets.init(BITS);
  return secrets.share(toHex(secret), shares, threshold);
}

/**
 * Combines an array of cryptographic hexadecimal shard pieces to reassemble the original raw secret text.
 *
 * @param shareHexValues - Collection of unique hexadecimal share string markers provided by threshold guardians.
 * @returns The original plaintext key string output.
 * @example
 * ```typescript
 * const recovered = combineShares([share1, share2, share3]);
 * ```
 */
export function combineShares(shareHexValues: string[]): string {
  secrets.init(BITS);
  return fromHex(secrets.combine(shareHexValues));
}

/**
 * Dynamically computes a balanced mathematical quorum boundary limit matching a traditional $\frac{2}{3}$ supermajority limit.
 *
 * @param guardianCount - Total count of active configured trusted account entities.
 * @returns Recommended minimum threshold bounds needed to enforce transactional execution paths.
 */
export function defaultRecoveryThreshold(guardianCount: number): number {
  if (guardianCount < 2) return 2;
  return Math.max(2, Math.ceil((guardianCount * 2) / 3));
}
