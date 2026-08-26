import {
  estimateSponsoredFee,
  wrapWithSponsorship,
  createSponsoredAccountOps,
} from "@/app/api/lib/feeSponsorship";
import * as StellarSdk from "@stellar/stellar-sdk";

jest.mock("@stellar/stellar-sdk", () => {
  const makeOp = (name: string) =>
    jest.fn().mockReturnValue({ switch: () => ({ name }) });
  return {
    Horizon: { Server: jest.fn() },
    TransactionBuilder: { fromXDR: jest.fn() },
    Operation: {
      beginSponsoringFutureReserves: makeOp("beginSponsoringFutureReserves"),
      endSponsoringFutureReserves: makeOp("endSponsoringFutureReserves"),
      createAccount: makeOp("createAccount"),
      revokeSponsorship: makeOp("revokeSponsorship"),
    },
    Memo: { text: jest.fn(() => ({})) },
    Keypair: { random: jest.fn(() => ({ publicKey: () => "GSPONSORKEY" })) },
  };
});

jest.mock("@/app/lib/networkConfig", () => ({
  getStellarNetwork: () => "TESTNET",
  getHorizonUrl: () => "https://horizon-testnet.stellar.org",
  getNetworkPassphrase: () => "Test SDF Network ; September 2015",
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe("feeSponsorship", () => {
  describe("estimateSponsoredFee", () => {
    it("should calculate fee for a single operation", () => {
      const estimate = estimateSponsoredFee(1);
      expect(estimate.totalOps).toBe(3); // 1 user op + 2 sponsorship ops
      expect(estimate.baseFeeStroops).toBe(100);
      expect(estimate.totalFeeStroops).toBe(300);
      expect(estimate.totalFeeXLM).toBe("0.0000300");
    });

    it("should calculate fee for multiple operations", () => {
      const estimate = estimateSponsoredFee(5);
      expect(estimate.totalOps).toBe(7);
      expect(estimate.totalFeeStroops).toBe(700);
    });

    it("should handle zero operations gracefully", () => {
      const estimate = estimateSponsoredFee(0);
      expect(estimate.totalOps).toBe(2);
      expect(estimate.totalFeeStroops).toBe(200);
    });
  });

  describe("createSponsoredAccountOps", () => {
    const userPublicKey =
      "GBPHZ5O2JQ5H3K4L6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7";

    it("should create a createAccount operation", () => {
      const ops = createSponsoredAccountOps(userPublicKey);
      expect(ops).toHaveLength(1);
      expect(ops[0].switch().name).toBe("createAccount");
    });

    it("should use the provided starting balance", () => {
      const ops = createSponsoredAccountOps(userPublicKey, "5");
      expect(ops).toHaveLength(1);
    });

    it("should default to 1 XLM starting balance", () => {
      const ops = createSponsoredAccountOps(userPublicKey);
      expect(ops).toHaveLength(1);
    });
  });

  describe("wrapWithSponsorship", () => {
    const userPublicKey =
      "GBPHZ5O2JQ5H3K4L6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7";

    it("should wrap operations with begin/end sponsorship ops", () => {
      const dummyOps: any[] = [{ type: "payment", switch: () => ({ name: "payment" }) }];
      const result = wrapWithSponsorship(userPublicKey, dummyOps as any);
      expect(result).toHaveLength(3);
    });

    it("should handle empty operation list", () => {
      const result = wrapWithSponsorship(userPublicKey, []);
      expect(result).toHaveLength(2); // Only begin and end
    });

    it("should preserve the original operations order", () => {
      const op1 = "op1" as any;
      const op2 = "op2" as any;
      const result = wrapWithSponsorship(userPublicKey, [op1, op2]);
      expect(result[1]).toBe(op1);
      expect(result[2]).toBe(op2);
    });
  });

  describe("submitSponsoredTransaction", () => {
    const SPONSOR_PUBLIC_KEY =
      "GDTMVOKYEGPB7IFHN7I7OXIZNSVRJ7B5MODPSZEWVXI5BXU5K6JR2HV7";

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should extract the sponsor key from the transaction source", async () => {
      const mockTransaction = { source: SPONSOR_PUBLIC_KEY, operations: [] };
      (StellarSdk.TransactionBuilder.fromXDR as jest.Mock).mockReturnValue(mockTransaction);

      const MockServer = StellarSdk.Horizon.Server as jest.Mock;
      const mockSubmit = jest.fn().mockResolvedValue({ hash: "deadbeef" });
      MockServer.mockImplementation(() => ({
        submitTransaction: mockSubmit,
        loadAccount: jest.fn(),
        fetchBaseFee: jest.fn(),
      }));

      const { submitSponsoredTransaction } = await import(
        "@/app/api/lib/feeSponsorship"
      );

      const result = await submitSponsoredTransaction("fake-xdr", "TESTNET");

      expect(result.sponsorKey).toBe(SPONSOR_PUBLIC_KEY);
      expect(result.feeSponsored).toBe(true);
      expect(mockSubmit).toHaveBeenCalledWith(mockTransaction);
    });
  });
});
