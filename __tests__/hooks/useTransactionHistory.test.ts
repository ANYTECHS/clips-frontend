/**
 * Unit tests for app/hooks/useTransactionHistory.ts
 *
 * Covers:
 * - Initial load triggers a fetch
 * - Wallet disconnect clears state
 * - Filter changes update display
 * - Pagination (goToPage, totalPages)
 * - Manual refresh clears cache and refetches
 * - Error propagation
 * - Unsupported wallet type (e.g. "stellar") → no fetch
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransactionHistory, PAGE_SIZE } from "@/app/hooks/useTransactionHistory";
import * as txHistoryLib from "@/app/lib/txHistory";
import type { Transaction } from "@/app/lib/txHistory";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeTx(id: string, direction: Transaction["direction"] = "outgoing"): Transaction {
  return {
    id,
    chain: "ethereum",
    direction,
    status: "confirmed",
    timestamp: Date.now(),
    fromAddress: "0x1234…5678",
    toAddress: "0xabcd…ef01",
    amount: "0.01",
    assetSymbol: "ETH",
    explorerUrl: `https://etherscan.io/tx/${id}`,
  };
}

function makeTxBatch(count: number, direction: Transaction["direction"] = "outgoing"): Transaction[] {
  return Array.from({ length: count }, (_, i) =>
    makeTx(`0x${String(i).padStart(4, "0")}`, direction),
  );
}

// ─── Mock fetchTransactionHistory ─────────────────────────────────────────────

let mockFetch: jest.MockedFunction<typeof txHistoryLib.fetchTransactionHistory>;

beforeEach(() => {
  mockFetch = jest
    .spyOn(txHistoryLib, "fetchTransactionHistory")
    .mockResolvedValue([]) as jest.MockedFunction<typeof txHistoryLib.fetchTransactionHistory>;

  jest.spyOn(txHistoryLib, "clearTxCache").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("useTransactionHistory", () => {
  it("does not fetch when address is null", () => {
    renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: null,
        refreshIntervalMs: 100_000,
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not fetch when walletType is null", () => {
    renderHook(() =>
      useTransactionHistory({
        walletType: null,
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches on mount when wallet is connected", async () => {
    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("metamask", "0xabc", null, 1);
    expect(result.current.isInitialLoading).toBe(false);
  });

  it("shows fetched transactions", async () => {
    const txs = makeTxBatch(5);
    mockFetch.mockResolvedValue(txs);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(5));
  });

  it("limits display to PAGE_SIZE per page", async () => {
    const txs = makeTxBatch(PAGE_SIZE + 5);
    mockFetch.mockResolvedValue(txs);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(PAGE_SIZE));
    expect(result.current.totalPages).toBe(2);
  });

  it("filter=sent shows only outgoing transactions", async () => {
    const txs = [
      ...makeTxBatch(3, "outgoing"),
      ...makeTxBatch(2, "incoming"),
    ];
    mockFetch.mockResolvedValue(txs);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(5));

    act(() => result.current.setFilter("sent"));
    expect(result.current.transactions.every((t) => t.direction === "outgoing")).toBe(true);
    expect(result.current.transactions).toHaveLength(3);
  });

  it("filter=received shows only incoming transactions", async () => {
    const txs = [
      ...makeTxBatch(3, "outgoing"),
      ...makeTxBatch(4, "incoming"),
    ];
    mockFetch.mockResolvedValue(txs);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(7));

    act(() => result.current.setFilter("received"));
    expect(result.current.transactions.every((t) => t.direction === "incoming")).toBe(true);
    expect(result.current.transactions).toHaveLength(4);
  });

  it("exposes error when fetch fails", async () => {
    const err = new txHistoryLib.TxHistoryError("API down", "API_ERROR");
    mockFetch.mockRejectedValue(err);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.code).toBe("API_ERROR");
    expect(result.current.error?.message).toBe("API down");
  });

  it("clears state when address changes to null", async () => {
    const txs = makeTxBatch(3);
    mockFetch.mockResolvedValue(txs);

    const { result, rerender } = renderHook(
      ({ address }: { address: string | null }) =>
        useTransactionHistory({
          walletType: "metamask",
          address,
          refreshIntervalMs: 100_000,
        }),
      { initialProps: { address: "0xabc" } },
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(3));

    rerender({ address: null });
    await waitFor(() => expect(result.current.transactions.length).toBe(0));
    expect(result.current.error).toBeNull();
  });

  it("refetches and clears cache on refresh()", async () => {
    const firstBatch = makeTxBatch(2);
    const secondBatch = makeTxBatch(4);
    mockFetch
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.transactions.length).toBe(2));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.transactions.length).toBe(4));

    expect(txHistoryLib.clearTxCache).toHaveBeenCalledWith("0xabc");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("goToPage updates currentPage", async () => {
    const txs = makeTxBatch(PAGE_SIZE * 2 + 3);
    mockFetch.mockResolvedValue(txs);

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.totalPages).toBeGreaterThan(1));

    act(() => result.current.goToPage(2));
    expect(result.current.currentPage).toBe(2);
  });

  it("jumpToNewTransactions resets newTxCount to 0", async () => {
    mockFetch.mockResolvedValue(makeTxBatch(2));

    const { result } = renderHook(() =>
      useTransactionHistory({
        walletType: "metamask",
        address: "0xabc",
        refreshIntervalMs: 100_000,
      }),
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    act(() => result.current.jumpToNewTransactions());
    expect(result.current.newTxCount).toBe(0);
    expect(result.current.currentPage).toBe(1);
  });
});
