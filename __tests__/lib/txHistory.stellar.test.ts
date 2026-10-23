/**
 * Unit tests for the Stellar helpers in app/lib/txHistory.ts
 */

import {
  clearStellarTxCache,
  fetchStellarTransactions,
  filterStellarTransactions,
  getStellarTxExplorerUrl,
  type StellarTransaction,
} from "@/app/lib/txHistory";

const ADDRESS = "GA" + "A".repeat(54);

function tx(overrides: Partial<StellarTransaction>): StellarTransaction {
  return {
    id: "1",
    hash: "abc",
    type: "payment",
    createdAt: "2026-10-01T12:00:00Z",
    amount: "1",
    asset: "XLM",
    counterparty: null,
    status: "success",
    pagingToken: "1",
    ...overrides,
  };
}

describe("filterStellarTransactions", () => {
  const txs = [
    tx({ id: "a", type: "payment", asset: "XLM", createdAt: "2026-09-30T23:00:00Z" }),
    tx({ id: "b", type: "mint", asset: "NFT", createdAt: "2026-10-01T00:00:00Z" }),
    tx({ id: "c", type: "trustline", asset: "USDC", createdAt: "2026-10-05T10:00:00Z" }),
    tx({ id: "d", type: "payment", asset: "USDC", createdAt: "2026-10-10T10:00:00Z" }),
  ];
  const ids = (list: StellarTransaction[]) => list.map((t) => t.id);

  it("returns everything with no filters", () => {
    expect(ids(filterStellarTransactions(txs, {}))).toEqual(["a", "b", "c", "d"]);
    expect(ids(filterStellarTransactions(txs, { type: "all" }))).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by type", () => {
    expect(ids(filterStellarTransactions(txs, { type: "payment" }))).toEqual(["a", "d"]);
    expect(ids(filterStellarTransactions(txs, { type: "mint" }))).toEqual(["b"]);
    expect(ids(filterStellarTransactions(txs, { type: "trustline" }))).toEqual(["c"]);
  });

  it("filters by asset case-insensitively", () => {
    expect(ids(filterStellarTransactions(txs, { asset: "usdc" }))).toEqual(["c", "d"]);
  });

  it("filters by inclusive date range", () => {
    expect(
      ids(filterStellarTransactions(txs, { from: "2026-10-01", to: "2026-10-05" }))
    ).toEqual(["b", "c"]);
  });

  it("combines filters", () => {
    expect(
      ids(filterStellarTransactions(txs, { type: "payment", asset: "USDC", from: "2026-10-02" }))
    ).toEqual(["d"]);
  });
});

describe("getStellarTxExplorerUrl", () => {
  it("uses the testnet explorer for testnet", () => {
    expect(getStellarTxExplorerUrl("abc", "testnet")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc"
    );
  });

  it("uses the public explorer for mainnet", () => {
    expect(getStellarTxExplorerUrl("abc", "mainnet")).toBe(
      "https://stellar.expert/explorer/public/tx/abc"
    );
  });
});

describe("fetchStellarTransactions", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    clearStellarTxCache();
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ transactions: [tx({})], nextCursor: "123" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("calls GET /api/wallet/transactions with cursor, limit and filters", async () => {
    const result = await fetchStellarTransactions({
      address: ADDRESS,
      network: "testnet",
      cursor: "99",
      limit: 10,
      filters: { type: "payment", asset: "XLM", from: "2026-01-01", to: "2026-02-01" },
    });

    expect(result.nextCursor).toBe("123");
    const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/wallet/transactions");
    expect(url.searchParams.get("publicKey")).toBe(ADDRESS);
    expect(url.searchParams.get("cursor")).toBe("99");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("type")).toBe("payment");
    expect(url.searchParams.get("asset")).toBe("XLM");
    expect(url.searchParams.get("from")).toBe("2026-01-01");
    expect(url.searchParams.get("to")).toBe("2026-02-01");
  });

  it("caches recent pages to avoid repeat API calls", async () => {
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet" });
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Different cursor → different cache entry
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet", cursor: "5" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache when forced or cleared", async () => {
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet" });
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet", force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    clearStellarTxCache(ADDRESS);
    await fetchStellarTransactions({ address: ADDRESS, network: "testnet" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws a TxHistoryError on API failure", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });
    await expect(
      fetchStellarTransactions({ address: ADDRESS, network: "testnet" })
    ).rejects.toMatchObject({ code: "API_ERROR" });
  });
});
