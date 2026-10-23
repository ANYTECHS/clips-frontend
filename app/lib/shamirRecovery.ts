import secrets from "secrets.js-grempe";

const BITS = 8;
/** With 8-bit fields secrets.js supports at most 2^8 - 1 shares. */
const MAX_SHARES = 255;

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
 * @param totalShares - Total number of shares to generate (or a legacy options object).
 * @param threshold - Minimum number of shares required to reconstruct the secret.
 * @returns An array of cryptographically isolated hexadecimal shard pieces.
 * @throws {Error} Thrown if the recovery threshold is less than 2, or if total shares are less than the quorum threshold.
 * @example
 * ```typescript
 * const shares = splitSecret("my_secret_key", 5, 3);
 * ```
 */
export function splitSecret(secret: string, totalShares: number, threshold: number): string[];
export function splitSecret(secret: string, options: ShamirSplitOptions): string[];
export function splitSecret(
  secret: string,
  totalSharesOrOptions: number | ShamirSplitOptions,
  thresholdArg?: number
): string[] {
  const { shares, threshold } =
    typeof totalSharesOrOptions === "number"
      ? { shares: totalSharesOrOptions, threshold: thresholdArg ?? NaN }
      : totalSharesOrOptions;

  if (!secret) {
    throw new Error("Secret must not be empty.");
  }
  if (!Number.isInteger(shares) || !Number.isInteger(threshold)) {
    throw new Error("Share count and threshold must be integers.");
  }
  if (threshold < 2) {
    throw new Error("Recovery threshold must be at least 2.");
  }
  if (shares < threshold) {
    throw new Error("Number of guardians must be at least the recovery threshold.");
  }
  if (shares > MAX_SHARES) {
    throw new Error(`Number of shares cannot exceed ${MAX_SHARES}.`);
  }

  secrets.init(BITS);
  return secrets.share(toHex(secret), shares, threshold);
}

/**
 * Combines an array of cryptographic hexadecimal shard pieces to reassemble the original raw secret text.
 *
 * Note: Shamir's scheme cannot detect on its own that too few shares were
 * supplied — combining below the threshold yields garbage, not an error. Pass
 * `threshold` whenever it is known so insufficient input fails loudly.
 *
 * @param shareHexValues - Collection of unique hexadecimal share string markers provided by threshold guardians.
 * @param threshold - Optional minimum number of distinct shares required.
 * @returns The original plaintext key string output.
 * @throws {Error} Thrown when fewer than `threshold` distinct shares are supplied or a share is malformed.
 * @example
 * ```typescript
 * const recovered = combineShares([share1, share2, share3]);
 * ```
 */
export function combineShares(shareHexValues: string[], threshold?: number): string {
  const unique = Array.from(new Set(shareHexValues.map((s) => s.trim()).filter(Boolean)));
  if (unique.length < Math.max(2, threshold ?? 2)) {
    throw new Error(
      `Insufficient shares: ${unique.length} provided, ${Math.max(2, threshold ?? 2)} required.`
    );
  }

  secrets.init(BITS);
  // extractShareComponents throws on malformed input, surfacing bad shares early.
  for (const share of unique) {
    secrets.extractShareComponents(share);
  }
  return fromHex(secrets.combine(unique));
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
