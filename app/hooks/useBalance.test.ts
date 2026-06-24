import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useBalance,
  getBalance,
  fetchXLMPrice,
  resetXlmPriceCache,
  configureXlmPriceCacheTtl,
} from "./useBalance";

global.fetch = jest.fn();

describe("getBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetXlmPriceCache();
  });

  it("should fetch balance successfully from testnet", async () => {
    const mockAccountData = {
      balances: [
        {
          asset_type: "native",
          balance: "1234.5678900",
        },
      ],
    };

    const mockPriceData = {
      price: 0.12,
      stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

    const balance = await getBalance("GTEST123", "TESTNET");

    expect(balance.xlm).toBe("1234.5678900");
    expect(balance.xlmRaw).toBe(1234.56789);
    expect(balance.usd).toBe("148.15");
    expect(balance.usdRaw).toBeCloseTo(148.15, 2);
    expect(balance.lastUpdated).toBeInstanceOf(Date);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://horizon-testnet.stellar.org/accounts/GTEST123"
    );
  });

  it("should fetch balance successfully from mainnet", async () => {
    const mockAccountData = {
      balances: [
        {
          asset_type: "native",
          balance: "5000.0000000",
        },
      ],
    };

    const mockPriceData = {
      price: 0.15,
      stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

    const balance = await getBalance("GPUBLIC123", "PUBLIC");

    expect(balance.xlm).toBe("5000.0000000");
    expect(balance.usd).toBe("750.00");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://horizon.stellar.org/accounts/GPUBLIC123"
    );
  });

  it("should handle account not found error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(getBalance("GNOTFOUND", "TESTNET")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
      message: expect.stringContaining("Account not found"),
    });
  });

  it("should handle fetch error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(getBalance("GTEST123", "TESTNET")).rejects.toMatchObject({
      code: "FETCH_ERROR",
      message: expect.stringContaining("Failed to fetch"),
    });
  });

  it("should handle missing XLM balance", async () => {
    const mockAccountData = {
      balances: [
        {
          asset_type: "credit_alphanum4",
          balance: "100.0000000",
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccountData,
    });

    await expect(getBalance("GTEST123", "TESTNET")).rejects.toMatchObject({
      code: "NO_BALANCE",
      message: expect.stringContaining("No XLM balance"),
    });
  });

  it("should use fallback price if CoinGecko fails", async () => {
    const mockAccountData = {
      balances: [
        {
          asset_type: "native",
          balance: "100.0000000",
        },
      ],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockRejectedValueOnce(new Error("Network error"));

    const balance = await getBalance("GTEST123", "TESTNET");

    expect(balance.usd).toBe("12.00");
    expect(balance.isPriceStale).toBe(true);
  });
});

describe("fetchXLMPrice caching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetXlmPriceCache();
    configureXlmPriceCacheTtl(300_000);
  });

  it("shares cached price across concurrent callers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ price: 0.25, stale: false }),
    });

    const [first, second] = await Promise.all([fetchXLMPrice(), fetchXLMPrice()]);

    expect(first).toEqual({ price: 0.25, isStale: false });
    expect(second).toEqual({ price: 0.25, isStale: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns cached price without refetching within TTL", async () => {
    configureXlmPriceCacheTtl(60_000);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ price: 0.18, stale: false }),
    });

    await fetchXLMPrice();
    const cached = await fetchXLMPrice();

    expect(cached).toEqual({ price: 0.18, isStale: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to last known price on HTTP 429 with stale flag", async () => {
    jest.useFakeTimers();
    configureXlmPriceCacheTtl(1_000);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: 0.14, stale: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

    await fetchXLMPrice();
    jest.advanceTimersByTime(2_000);

    const result = await fetchXLMPrice();

    expect(result).toEqual({ price: 0.14, isStale: true });
    jest.useRealTimers();
  });
});

describe("useBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetXlmPriceCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should initialize with null balance", () => {
    const { result } = renderHook(() =>
      useBalance({ publicKey: null, network: "TESTNET" })
    );

    expect(result.current.balance).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetchTime).toBeNull();
  });

  it("should fetch balance when publicKey is provided", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "1000.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValue({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: false,
      })
    );

    await waitFor(() => {
      expect(result.current.balance).not.toBeNull();
    });

    expect(result.current.balance?.xlm).toBe("1000.0000000");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const onError = jest.fn();

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: false,
        onError,
      })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND");
    expect(result.current.balance).toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("should call onSuccess callback", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "500.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: false,
        onSuccess,
      })
    );

    await waitFor(() => {
      expect(result.current.balance).not.toBeNull();
    });

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        xlm: "500.0000000",
      })
    );
  });

  it("should refresh balance manually", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "1000.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValue({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockPriceData,
      });

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: false,
      })
    );

    await waitFor(() => {
      expect(result.current.balance).not.toBeNull();
    });

    const firstFetchTime = result.current.lastFetchTime;

    // Wait a bit
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Manual refresh
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.lastFetchTime).not.toBe(firstFetchTime);
    });
  });

  it("should auto-refresh at specified interval", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "1000.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValue({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockPriceData,
      });

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: true,
        refreshInterval: 5000, // 5 seconds for testing
      })
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.balance).not.toBeNull();
    });

    const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length;

    // Fast-forward time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Wait for auto-refresh
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
        initialFetchCount
      );
    });

    expect(result.current.isAutoRefreshing).toBe(true);
  });

  it("should clear error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const { result } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: false,
      })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("should clear balance when publicKey is removed", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "1000.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

    const { result, rerender } = renderHook(
      ({ publicKey }) =>
        useBalance({
          publicKey,
          network: "TESTNET",
          autoRefresh: false,
        }),
      {
        initialProps: { publicKey: "GTEST123" },
      }
    );

    await waitFor(() => {
      expect(result.current.balance).not.toBeNull();
    });

    // Remove public key
    rerender({ publicKey: null });

    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should stop auto-refresh on unmount", async () => {
    const mockAccountData = {
      balances: [{ asset_type: "native", balance: "1000.0000000" }],
    };

    const mockPriceData = {
      price: 0.12, stale: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValue({
        ok: true,
        json: async () => mockAccountData,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockPriceData,
      });

    const { unmount } = renderHook(() =>
      useBalance({
        publicKey: "GTEST123",
        network: "TESTNET",
        autoRefresh: true,
        refreshInterval: 5000,
      })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchCountBeforeUnmount = (global.fetch as jest.Mock).mock.calls
      .length;

    unmount();

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Fetch count should not increase after unmount
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(
      fetchCountBeforeUnmount
    );
  });
});
