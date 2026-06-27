import { calculateStellarMintCost, STELLAR_MINT_COSTS, formatXlm } from "@/app/lib/mintUtils";

describe("mintUtils", () => {
  describe("calculateStellarMintCost", () => {
    it("should calculate correct fee for 1 item", () => {
      const result = calculateStellarMintCost(1);
      expect(result.gasFee).toBe(STELLAR_MINT_COSTS.GAS_FEE_PER_ITEM);
      expect(result.totalCost).toBe(STELLAR_MINT_COSTS.GAS_FEE_PER_ITEM);
    });

    it("should calculate correct fee for multiple items", () => {
      const count = 5;
      const result = calculateStellarMintCost(count);
      const expected = count * STELLAR_MINT_COSTS.GAS_FEE_PER_ITEM;
      
      expect(result.gasFee).toBe(expected);
      expect(result.totalCost).toBe(expected);
    });

    it("should return zero for zero items", () => {
      const result = calculateStellarMintCost(0);
      expect(result.gasFee).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe("formatXlm", () => {
    it("should format zero correctly", () => {
      expect(formatXlm(0)).toBe("0.00 XLM");
    });

    it("should format standard float values correctly", () => {
      expect(formatXlm(12.345)).toBe("12.345 XLM");
    });

    it("should display the small Stellar base fees correctly", () => {
      expect(formatXlm(0.00001)).toBe("0.00001 XLM");
      expect(formatXlm(0.00005)).toBe("0.00005 XLM");
    });
  });
});
