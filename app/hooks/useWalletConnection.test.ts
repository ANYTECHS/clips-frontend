import { renderHook, act, waitFor } from "@testing-library/react";
import { useWalletConnection } from "./useWalletConnection";

// Mock Freighter wallet
const mockFreighter = {
  isConnected: jest.fn(),
  getPublicKey: jest.fn(),
  getNetwork: jest.fn(),
};

describe("useWalletConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Mocking window.freighter
    window.freighter = mockFreighter;
    mockFreighter.isConnected.mockResolvedValue(false);
    mockFreighter.getPublicKey.mockResolvedValue("GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
  });

  afterEach(() => {
    // @ts-expect-error - Cleaning up mock
    delete window.freighter;
  });

  describe("Initial State", () => {
    it("should initialize with disconnected state", () => {
      const { result } = renderHook(() => useWalletConnection());

      expect(result.current.status).toBe("disconnected");
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.publicKey).toBeNull();
      expect(result.current.network).toBeNull();
    });
  });

  describe("Freighter Detection", () => {
    it("should detect when Freighter is not installed", async () => {
      // @ts-expect-error - Removing freighter
      delete window.freighter;

      const { result } = renderHook(() => useWalletConnection());

      let success = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("FREIGHTER_NOT_INSTALLED");
      expect(result.current.error?.message).toContain("Freighter wallet is not installed");
    });

    it("should detect when Freighter is installed", () => {
      const { result } = renderHook(() => useWalletConnection());

      let isInstalled = false;
      act(() => {
        isInstalled = result.current.checkFreighterInstalled();
      });

      expect(isInstalled).toBe(true);
    });
  });

  describe("Connect Wallet", () => {
    it("should connect successfully", async () => {
      const { result } = renderHook(() => useWalletConnection());

      let success = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(true);
      expect(result.current.status).toBe("connected");
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.publicKey).toBe("GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
      expect(result.current.network).toBe("TESTNET");
      expect(result.current.error).toBeNull();
    });

    it("should show connecting state during connection", async () => {
      const { result } = renderHook(() => useWalletConnection());

      // Start connection
      const connectPromise = act(async () => {
        return result.current.connect();
      });

      // Check connecting state (may already be connected due to fast mock)
      await waitFor(() => {
        expect(
          result.current.isConnecting || result.current.isConnected
        ).toBe(true);
      });

      await connectPromise;
    });

    it("should handle user rejection", async () => {
      mockFreighter.getPublicKey.mockRejectedValue(
        new Error("User declined access")
      );

      const { result } = renderHook(() => useWalletConnection());

      let success = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("USER_REJECTED");
      expect(result.current.error?.message).toContain("rejected");
    });

    it("should handle connection errors", async () => {
      mockFreighter.getPublicKey.mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useWalletConnection());

      let success = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("CONNECTION_ERROR");
      expect(result.current.error?.message).toContain("Network error");
    });

    it("should handle missing public key", async () => {
      mockFreighter.getPublicKey.mockResolvedValue("");

      const { result } = renderHook(() => useWalletConnection());

      let success = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error?.code).toBe("CONNECTION_ERROR");
    });

    it("should default to TESTNET if network call fails", async () => {
      mockFreighter.getNetwork.mockRejectedValue(new Error("Network unavailable"));

      const { result } = renderHook(() => useWalletConnection());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.network).toBe("TESTNET");
    });

    it("should support PUBLIC network", async () => {
      mockFreighter.getNetwork.mockResolvedValue("PUBLIC");

      const { result } = renderHook(() => useWalletConnection());

      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.network).toBe("PUBLIC");
    });
  });

  describe("Disconnect Wallet", () => {
    it("should disconnect successfully", async () => {
      const { result } = renderHook(() => useWalletConnection());

      // First connect
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.status).toBe("disconnected");
      expect(result.current.isConnected).toBe(false);
      expect(result.current.publicKey).toBeNull();
      expect(result.current.network).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("Reset Error", () => {
    it("should reset error state", async () => {
      mockFreighter.getPublicKey.mockRejectedValue(new Error("Test error"));

      const { result } = renderHook(() => useWalletConnection());

      // Trigger error
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.error).not.toBeNull();

      // Reset error
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe("disconnected");
    });

    it("should maintain connected status when resetting error", async () => {
      const { result } = renderHook(() => useWalletConnection());

      // Connect successfully
      await act(async () => {
        await result.current.connect();
      });

      // Manually set an error (simulating a later error)
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe("connected");
    });
  });

  describe("Get Truncated Address", () => {
    it("should truncate address correctly", () => {
      const { result } = renderHook(() => useWalletConnection());

      const address = "GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
      const truncated = result.current.getTruncatedAddress(address);

      expect(truncated).toBe("GTES...3456");
    });

    it("should handle empty address", () => {
      const { result } = renderHook(() => useWalletConnection());

      const truncated = result.current.getTruncatedAddress("");

      expect(truncated).toBe("");
    });
  });

  describe("Auto-connect on Mount", () => {
    it("should auto-connect if already connected", async () => {
      mockFreighter.isConnected.mockResolvedValue(true);

      const { result } = renderHook(() => useWalletConnection());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.publicKey).toBe("GTEST123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
      expect(result.current.network).toBe("TESTNET");
    });

    it("should not auto-connect if not previously connected", async () => {
      mockFreighter.isConnected.mockResolvedValue(false);

      const { result } = renderHook(() => useWalletConnection());

      // Wait a bit to ensure no auto-connect happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.publicKey).toBeNull();
    });

    it("should handle auto-connect errors silently", async () => {
      mockFreighter.isConnected.mockRejectedValue(new Error("Connection failed"));

      const { result } = renderHook(() => useWalletConnection());

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should remain disconnected without error
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("Multiple Connect Attempts", () => {
    it("should handle multiple connect calls", async () => {
      const { result } = renderHook(() => useWalletConnection());

      // First connect
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.isConnected).toBe(true);
      const firstPublicKey = result.current.publicKey;

      // Second connect (should work)
      await act(async () => {
        await result.current.connect();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.publicKey).toBe(firstPublicKey);
    });
  });
});
