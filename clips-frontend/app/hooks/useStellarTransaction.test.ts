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
