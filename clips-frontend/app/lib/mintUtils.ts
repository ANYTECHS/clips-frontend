export const MINT_COSTS = {
  // Estimated gas + rent for Solana NFT (Metaplex)
  GAS_FEE_PER_ITEM: 0.01205,
  // Estimated Arweave storage cost for an average clip
  STORAGE_COST_PER_ITEM: 0.0015,
};

export function calculateMintCost(count: number) {
  const gasFee = count * MINT_COSTS.GAS_FEE_PER_ITEM;
  const storageCost = count * MINT_COSTS.STORAGE_COST_PER_ITEM;
  const totalCost = gasFee + storageCost;

  return {
    gasFee,
    storageCost,
    totalCost,
  };
}

export function formatSol(amount: number): string {
  if (amount === 0) return "0.00 SOL";
  
  // Format with up to 4 decimal places, avoiding trailing zeros where possible
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
  
  return `${formatted} SOL`;
}
