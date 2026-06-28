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
