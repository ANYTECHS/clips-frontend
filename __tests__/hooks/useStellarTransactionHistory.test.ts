/**
 * Unit tests for useStellarTransactionHistory (app/hooks/useTransactionHistory.ts)
 *
 * Covers cursor pagination, filter changes and refresh.
 */

import { act, renderHook, waitFor } from "@testing-library/react";

import { useStellarTransactionHistory } from "@/app/hooks/useTransactionHistory";
import * as txHistoryLib from "@/app/lib/txHistory";
import type { StellarTransaction, StellarTxPage } from "@/app/lib/txHistory";

const ADDRESS = "GA" + "A".repeat(54);

function makeTx(id: string, overrides: Partial<StellarTransaction> = {}): StellarTransaction {
  return {
    id,
    hash: `hash-${id}`,
    type: "payment",
    createdAt: "2026-10-01T12:00:00Z",
    amount: "10.0000000",
    asset: "XLM",
    counterparty: "GB" + "B".repeat(54),
    status: "success",
    pagingToken: id,
    ...overrides,
  };
}

function page(ids: string[], nextCursor: string | null): StellarTxPage {
  return { transactions: ids.map((id) => makeTx(id)), nextCursor };
}

let mockFetch: jest.SpiedFunction<typeof txHistoryLib.fetchStellarTransactions>;

beforeEach(() => {
  mockFetch = jest.spyOn(txHistoryLib, "fetchStellarTransactions");
  jest.spyOn(txHistoryLib, "clearStellarTxCache").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useStellarTransactionHistory", () => {
  it("does not fetch without an address", () => {
    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: null, network: "testnet" })
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.transactions).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("loads the first page with limit and no cursor", async () => {
    mockFetch.mockResolvedValueOnce(page(["1", "2"], "2"));
    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet", limit: 2 })
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDRESS, network: "testnet", limit: 2 })
    );
    expect(mockFetch.mock.calls[0][0].cursor).toBeUndefined();
    expect(result.current.transactions.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore appends the next page using the returned cursor", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["1", "2"], "2"))
      .mockResolvedValueOnce(page(["3", "4"], "4"))
      .mockResolvedValueOnce(page(["5"], null));

    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet", limit: 2 })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.transactions).toHaveLength(4));
    expect(mockFetch.mock.calls[1][0].cursor).toBe("2");

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.transactions).toHaveLength(5));
    expect(mockFetch.mock.calls[2][0].cursor).toBe("4");
    expect(result.current.hasMore).toBe(false);

    // Exhausted — further calls are no-ops
    act(() => result.current.loadMore());
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("ignores concurrent loadMore calls while a page is in flight", async () => {
    mockFetch.mockResolvedValueOnce(page(["1"], "1"));
    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet" })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolve!: (p: StellarTxPage) => void;
    mockFetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)));

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await act(async () => resolve(page(["2"], null)));
    expect(result.current.transactions.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("refetches from the first page when filters change", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["1", "2"], "2"))
      .mockResolvedValueOnce({ transactions: [makeTx("9", { type: "mint" })], nextCursor: null });

    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet" })
    );
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    act(() =>
      result.current.setFilters({ type: "mint", asset: "NFT", from: "2026-01-01", to: "2026-12-31" })
    );

    await waitFor(() => expect(result.current.transactions.map((t) => t.id)).toEqual(["9"]));
    const call = mockFetch.mock.calls[1][0];
    expect(call.filters).toEqual({ type: "mint", asset: "NFT", from: "2026-01-01", to: "2026-12-31" });
    expect(call.cursor).toBeUndefined();
    expect(result.current.hasMore).toBe(false);
  });

  it("refresh bypasses the cache", async () => {
    mockFetch.mockResolvedValue(page(["1"], null));
    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet" })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(txHistoryLib.clearStellarTxCache).toHaveBeenCalledWith(ADDRESS);
    expect(mockFetch.mock.calls[1][0].force).toBe(true);
  });

  it("surfaces fetch errors", async () => {
    mockFetch.mockRejectedValueOnce(new txHistoryLib.TxHistoryError("boom", "API_ERROR"));
    const { result } = renderHook(() =>
      useStellarTransactionHistory({ address: ADDRESS, network: "testnet" })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.code).toBe("API_ERROR");
  });
});
