// ─── Stellar mint utilities ───────────────────────────────────────────────────

export function formatXlm(amount: number): string {
  if (amount === 0) return "0.00 XLM";
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(amount);
  
  return `${formatted} XLM`;
}

export const STELLAR_MINT_COSTS = {
  GAS_FEE_PER_ITEM: 0.00001, // 100 stroops per operation
};

export function calculateStellarMintCost(count: number) {
  const gasFee = count * STELLAR_MINT_COSTS.GAS_FEE_PER_ITEM;
  return {
    gasFee,
    totalCost: gasFee,
  };
}

// ─── Clip NFT minting ─────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000;

/** Royalty pre-filled in the mint preview. */
export const DEFAULT_ROYALTY_PERCENT = 10;

/** Highest royalty a creator may set on a clip NFT. */
export const MAX_ROYALTY_PERCENT = 50;

/** Clip statuses that are still being produced, or already minted, and so cannot be minted. */
const NON_MINTABLE_STATUSES = new Set(["processing", "queued", "failed", "error", "minted"]);

/** Minimal clip shape needed to mint. */
export interface MintableClip {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  nftTokenId?: string | null;
}

/** Metadata shown in the mint preview and written to the NFT contract. */
export interface ClipNftMetadata {
  title: string;
  description: string;
  /** Thumbnail URL used as the NFT image. */
  thumbnail: string;
  /** Creator royalty, 0–MAX_ROYALTY_PERCENT. */
  royaltyPercent: number;
}

/** Estimated cost of a mint, split into the network fee and the contract (Soroban resource) fee. */
export interface MintCostEstimate {
  networkFeeXlm: number;
  contractFeeXlm: number;
  totalXlm: number;
}

/** Whether a clip is finished processing and has not been minted yet. */
export function isClipMintable(clip: MintableClip): boolean {
  return !clip.nftTokenId && !NON_MINTABLE_STATUSES.has(clip.status);
}

/** Clamp a royalty to the allowed range, rounded to two decimals. */
export function clampRoyaltyPercent(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_ROYALTY_PERCENT;
  return Math.round(Math.min(MAX_ROYALTY_PERCENT, Math.max(0, percent)) * 100) / 100;
}

/** Convert a royalty percentage to basis points (10% → 1000). */
export function royaltyPercentToBps(percent: number): number {
  return Math.round(clampRoyaltyPercent(percent) * 100);
}

/**
 * Build the default NFT metadata for a clip.
 *
 * @param clip - The clip to mint.
 * @param overrides - Values edited by the creator in the preview.
 */
export function buildClipNftMetadata(
  clip: MintableClip,
  overrides: Partial<Omit<ClipNftMetadata, "thumbnail">> = {}
): ClipNftMetadata {
  return {
    title: (overrides.title ?? clip.title).trim().slice(0, 100),
    description: (overrides.description ?? `ClipCash clip "${clip.title}"`).trim().slice(0, 500),
    thumbnail: clip.thumbnail,
    royaltyPercent: clampRoyaltyPercent(overrides.royaltyPercent ?? DEFAULT_ROYALTY_PERCENT),
  };
}

/**
 * Estimate the XLM cost of a mint from the simulated transaction fees.
 *
 * @param fees.inclusionFeeStroops - Network (inclusion) fee.
 * @param fees.resourceFeeStroops - Soroban resource fee charged for the contract call.
 */
export function calculateClipMintCost(fees: {
  inclusionFeeStroops: number;
  resourceFeeStroops: number;
}): MintCostEstimate {
  const networkFeeXlm = fees.inclusionFeeStroops / STROOPS_PER_XLM;
  const contractFeeXlm = fees.resourceFeeStroops / STROOPS_PER_XLM;
  return {
    networkFeeXlm,
    contractFeeXlm,
    totalXlm: (fees.inclusionFeeStroops + fees.resourceFeeStroops) / STROOPS_PER_XLM,
  };
}
