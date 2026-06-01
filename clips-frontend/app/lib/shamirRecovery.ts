import secrets from "secrets.js-grempe";

const BITS = 8;

function toHex(secret: string): string {
  return Array.from(secret, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(
    ""
  );
}

function fromHex(hex: string): string {
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    chars.push(String.fromCharCode(parseInt(hex.slice(i, i + 2), 16)));
  }
  return chars.join("");
}

export type ShamirSplitOptions = {
  shares: number;
  threshold: number;
};

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

export function combineShares(shareHexValues: string[]): string {
  secrets.init(BITS);
  return fromHex(secrets.combine(shareHexValues));
}

export function defaultRecoveryThreshold(guardianCount: number): number {
  if (guardianCount < 2) return 2;
  return Math.max(2, Math.ceil((guardianCount * 2) / 3));
}
