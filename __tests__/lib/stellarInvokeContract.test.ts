import {
  createInvokeContractOp,
  invokeContractBuildError,
  INVOKE_CONTRACT_USER_MESSAGE,
  isInvokeContractBuildError,
} from "@/app/lib/stellarOperations";
import { buildBatchTransaction } from "@/app/lib/stellar";

jest.mock("@/app/lib/sentry", () => ({
  captureSorobanNotSupportedWarning: jest.fn(),
}));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          accountId: () => "GTEST123456789",
          sequenceNumber: () => "1",
        }),
        fetchBaseFee: jest.fn().mockResolvedValue(100),
      })),
    },
  };
});

describe("invoke_contract", () => {
  it("returns a typed error result instead of throwing", () => {
    const error = invokeContractBuildError();
    expect(error.code).toBe("INVOKE_CONTRACT_NOT_SUPPORTED");
    expect(error.message).toBe(INVOKE_CONTRACT_USER_MESSAGE);
    expect(isInvokeContractBuildError(error)).toBe(true);
  });

  it("buildBatchTransaction returns ok:false for invoke_contract operations", async () => {
    const result = await buildBatchTransaction("GTEST123456789", [
      createInvokeContractOp({
        contractId: "CABC123",
        method: "transfer",
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(INVOKE_CONTRACT_USER_MESSAGE);
      expect(result.operationIndex).toBe(0);
    }
  });
});
