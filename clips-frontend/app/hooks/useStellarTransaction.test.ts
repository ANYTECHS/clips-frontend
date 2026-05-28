import { renderHook, act, waitFor } from "@testing-library/react";
import { useStellarTransaction } from "./useStellarTransaction";

// Mock Freighter wallet
const mockFreighter = {
  isConnected: jest.fn(),
  getPublicKey: jest.fn(),
  signTransaction: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

describe("useStellarTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Mocking window.freighter
    window.freighter = mockFreighter;
    mockFreighter.isConnected.mockResolvedValue(true);
    mockFreighter.getPublicKey.mockResolvedValue("GTEST123456789");
    mockFreighter.signTransaction.mockResolvedValue("signed_xdr_string");
  });

  afterEach(() => {
    // @ts-expect-error - Cleaning up mock
    delete window.freighter;
  });

  describe("Initial State", () => {
    it("should initialize with idle state", () => {
      const { result } = renderHook(() => useStellarTransaction());

      expect(result.current.status).toBe("idle");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.transactionHash).toBeNull();
    });
  });

  describe("Freighter Detection", () => {
    it("should detect when Freighter is not installed", () => {
      // @ts-expect-error - Removing freighter
      delete window.freighter;

      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.checkFreighterInstalled();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("FREIGHTER_NOT_INSTALLED");
    });

    it("should detect when Freighter is installed", () => {
      const { result } = renderHook(() => useStellarTransaction());

      let isInstalled = false;
      act(() => {
        isInstalled = result.current.checkFreighterInstalled();
      });

      expect(isInstalled).toBe(true);
    });
  });

  describe("Get Public Key", () => {
    it("should retrieve public key from Freighter", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      let publicKey = "";
      await act(async () => {
        publicKey = await result.current.getPublicKey();
      });

      expect(publicKey).toBe("GTEST123456789");
      expect(mockFreighter.getPublicKey).toHaveBeenCalledTimes(1);
    });

    it("should handle error when getting public key fails", async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error("Connection failed"));

      const { result } = renderHook(() => useStellarTransaction());

      await expect(async () => {
        await act(async () => {
          await result.current.getPublicKey();
        });
      }).rejects.toMatchObject({
        code: "PUBLIC_KEY_ERROR",
        message: "Connection failed",
      });
    });
  });

  describe("Execute Transaction", () => {
    const mockTransactionResult = {
      hash: "abc123",
      ledger: 12345,
      envelope_xdr: "envelope",
      result_xdr: "result",
      result_meta_xdr: "meta",
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTransactionResult,
      });
    });

    it("should execute transaction successfully", async () => {
      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ onSuccess })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("success");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.result).toEqual(mockTransactionResult);
      expect(result.current.transactionHash).toBe("abc123");
      expect(onSuccess).toHaveBeenCalledWith(mockTransactionResult);
    });

    it("should go through all transaction stages", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");
      const statuses: string[] = [];

      // Track status changes
      const promise = act(async () => {
        const executePromise = result.current.executeTransaction(buildTransaction);
        
        // Capture initial status
        statuses.push(result.current.status);
        
        await executePromise;
      });

      await promise;

      // Should have gone through: building -> signing -> submitting -> success
      expect(statuses).toContain("building");
      expect(result.current.status).toBe("success");
    });

    it("should handle user rejection", async () => {
      mockFreighter.signTransaction.mockRejectedValue(
        new Error("User declined to sign the transaction")
      );

      const onError = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ onError })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("USER_REJECTED");
      expect(onError).toHaveBeenCalled();
    });

    it("should retry on network errors", async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTransactionResult,
        });

      const { result } = renderHook(() =>
        useStellarTransaction({ maxRetries: 3 })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("success");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const onError = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ maxRetries: 2, onError })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("NETWORK_ERROR");
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalled();
    });

    it("should handle submission errors from Horizon", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          title: "Transaction Failed",
          extras: {
            result_codes: {
              transaction: "tx_insufficient_balance",
            },
          },
        }),
      });

      const { result } = renderHook(() => useStellarTransaction());

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("tx_insufficient_balance");
      expect(result.current.error?.message).toBe("Transaction Failed");
    });

    it("should use correct Horizon URL for testnet", async () => {
      const { result } = renderHook(() =>
        useStellarTransaction({ network: "testnet" })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://horizon-testnet.stellar.org/transactions",
        expect.any(Object)
      );
    });

    it("should use correct Horizon URL for mainnet", async () => {
      const { result } = renderHook(() =>
        useStellarTransaction({ network: "mainnet" })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://horizon.stellar.org/transactions",
        expect.any(Object)
      );
    });
  });

  describe("Reset", () => {
    it("should reset state to initial values", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      // Execute a transaction first
      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(result.current.status).toBe("success");

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.transactionHash).toBeNull();
    });
  });

  describe("Cancel", () => {
    it("should cancel ongoing transaction", async () => {
      // Mock a slow fetch
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ hash: "abc" }),
                }),
              5000
            )
          )
      );

      const { result } = renderHook(() => useStellarTransaction());

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      // Start transaction
      act(() => {
        result.current.executeTransaction(buildTransaction);
      });

      // Wait a bit then cancel
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        result.current.cancel();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Network Configuration", () => {
    it("should pass correct network to Freighter when signing", async () => {
      const { result } = renderHook(() =>
        useStellarTransaction({ network: "mainnet" })
      );

      const buildTransaction = jest.fn().mockResolvedValue("transaction_xdr");

      await act(async () => {
        await result.current.executeTransaction(buildTransaction);
      });

      expect(mockFreighter.signTransaction).toHaveBeenCalledWith(
        "transaction_xdr",
        {
          network: "mainnet",
          accountToSign: "GTEST123456789",
        }
      );
    });
  });
});

// ─── Batch transaction tests ──────────────────────────────────────────────────

import {
  createPaymentOp,
  createChangeTrustOp,
  createManageSellOfferOp,
} from "../lib/stellarOperations";

describe("useStellarTransaction — batch operations", () => {
  const mockTransactionResult = {
    hash: "batchhash456",
    ledger: 99999,
    envelope_xdr: "envelope",
    result_xdr: "result",
    result_meta_xdr: "meta",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Mocking window.freighter
    window.freighter = mockFreighter;
    mockFreighter.isConnected.mockResolvedValue(true);
    mockFreighter.getPublicKey.mockResolvedValue("GTEST123456789");
    mockFreighter.signTransaction.mockResolvedValue("signed_batch_xdr");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockTransactionResult,
    });
  });

  afterEach(() => {
    // @ts-expect-error - Cleaning up mock
    delete window.freighter;
  });

  describe("addOperation", () => {
    it("should start with an empty operation queue", () => {
      const { result } = renderHook(() => useStellarTransaction());
      expect(result.current.queuedOperations).toHaveLength(0);
    });

    it("should add a single operation to the queue", () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST123", amount: "10" }),
          "Pay 10 XLM"
        );
      });

      expect(result.current.queuedOperations).toHaveLength(1);
      expect(result.current.queuedOperations[0].operation.type).toBe("payment");
      expect(result.current.queuedOperations[0].label).toBe("Pay 10 XLM");
    });

    it("should add multiple operations to the queue", () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createChangeTrustOp({ assetCode: "USDC", assetIssuer: "GISSUER123" }),
          "Add USDC trustline"
        );
        result.current.addOperation(
          createPaymentOp({
            destination: "GDEST123",
            amount: "100",
            assetCode: "USDC",
            assetIssuer: "GISSUER123",
          }),
          "Pay 100 USDC"
        );
      });

      expect(result.current.queuedOperations).toHaveLength(2);
      expect(result.current.queuedOperations[0].operation.type).toBe("change_trust");
      expect(result.current.queuedOperations[1].operation.type).toBe("payment");
    });

    it("should throw BatchValidationError for invalid operation", () => {
      const { result } = renderHook(() => useStellarTransaction());

      expect(() => {
        act(() => {
          // Missing assetIssuer — should fail validation
          result.current.addOperation(
            createChangeTrustOp({ assetCode: "USDC", assetIssuer: "" })
          );
        });
      }).toThrow();
    });
  });

  describe("removeOperation", () => {
    it("should remove an operation by index", () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" }),
          "First"
        );
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST2", amount: "10" }),
          "Second"
        );
      });

      act(() => {
        result.current.removeOperation(0);
      });

      expect(result.current.queuedOperations).toHaveLength(1);
      expect(result.current.queuedOperations[0].label).toBe("Second");
    });
  });

  describe("clearOperations", () => {
    it("should clear all queued operations", () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" })
        );
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST2", amount: "10" })
        );
      });

      expect(result.current.queuedOperations).toHaveLength(2);

      act(() => {
        result.current.clearOperations();
      });

      expect(result.current.queuedOperations).toHaveLength(0);
    });

    it("should not affect transaction status when clearing", () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" })
        );
        result.current.clearOperations();
      });

      expect(result.current.status).toBe("idle");
    });
  });

  describe("executeBatchTransaction", () => {
    it("should execute a batch of operations successfully", async () => {
      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ onSuccess })
      );

      act(() => {
        result.current.addOperation(
          createChangeTrustOp({ assetCode: "USDC", assetIssuer: "GISSUER123" }),
          "Add USDC trustline"
        );
        result.current.addOperation(
          createPaymentOp({
            destination: "GDEST123",
            amount: "50",
            assetCode: "USDC",
            assetIssuer: "GISSUER123",
          }),
          "Pay 50 USDC"
        );
      });

      const buildBatch = jest.fn().mockResolvedValue("batch_xdr_string");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(buildBatch).toHaveBeenCalledWith([
        expect.objectContaining({ type: "change_trust" }),
        expect.objectContaining({ type: "payment" }),
      ]);
      expect(result.current.status).toBe("success");
      expect(result.current.transactionHash).toBe("batchhash456");
      expect(onSuccess).toHaveBeenCalledWith(mockTransactionResult);
    });

    it("should clear the queue after a successful batch", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" })
        );
      });

      const buildBatch = jest.fn().mockResolvedValue("batch_xdr");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(result.current.status).toBe("success");
      expect(result.current.queuedOperations).toHaveLength(0);
    });

    it("should return error when queue is empty", async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ onError })
      );

      const buildBatch = jest.fn();

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("EMPTY_BATCH");
      expect(buildBatch).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    it("should pass all queued operations to the builder", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      const ops = [
        createChangeTrustOp({ assetCode: "USDC", assetIssuer: "GISSUER1" }),
        createChangeTrustOp({ assetCode: "BTC", assetIssuer: "GISSUER2" }),
        createPaymentOp({ destination: "GDEST", amount: "1" }),
      ];

      act(() => {
        ops.forEach((op) => result.current.addOperation(op));
      });

      const buildBatch = jest.fn().mockResolvedValue("multi_xdr");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(buildBatch).toHaveBeenCalledWith(ops);
    });

    it("should handle batch builder errors gracefully", async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useStellarTransaction({ onError })
      );

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" })
        );
      });

      const buildBatch = jest
        .fn()
        .mockRejectedValue(new Error("Failed to build batch XDR"));

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(result.current.status).toBe("error");
      expect(onError).toHaveBeenCalled();
    });

    it("should preserve the queue on error so the user can retry", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" }),
          "Pay 5 XLM"
        );
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          title: "Transaction Failed",
          extras: { result_codes: { transaction: "tx_failed" } },
        }),
      });

      const buildBatch = jest.fn().mockResolvedValue("failing_xdr");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(result.current.status).toBe("error");
      // Queue should still have the operation so the user can retry
      expect(result.current.queuedOperations).toHaveLength(1);
    });

    it("should support the trustline + payment preset pattern", async () => {
      const { result } = renderHook(() => useStellarTransaction());

      // Simulate the common trustlineAndPayment preset
      const trustlineOp = createChangeTrustOp({
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      });
      const paymentOp = createPaymentOp({
        destination: "GDEST123",
        amount: "100",
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      });

      act(() => {
        result.current.addOperation(trustlineOp, "Add USDC trustline");
        result.current.addOperation(paymentOp, "Receive 100 USDC");
      });

      expect(result.current.queuedOperations).toHaveLength(2);

      const buildBatch = jest.fn().mockResolvedValue("trustline_payment_xdr");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(result.current.status).toBe("success");
      expect(buildBatch).toHaveBeenCalledWith([trustlineOp, paymentOp]);
    });

    it("should sign the batch XDR with the correct network", async () => {
      const { result } = renderHook(() =>
        useStellarTransaction({ network: "mainnet" })
      );

      act(() => {
        result.current.addOperation(
          createPaymentOp({ destination: "GDEST1", amount: "5" })
        );
      });

      const buildBatch = jest.fn().mockResolvedValue("mainnet_batch_xdr");

      await act(async () => {
        await result.current.executeBatchTransaction(buildBatch);
      });

      expect(mockFreighter.signTransaction).toHaveBeenCalledWith(
        "mainnet_batch_xdr",
        expect.objectContaining({ network: "mainnet" })
      );
    });
  });
});
