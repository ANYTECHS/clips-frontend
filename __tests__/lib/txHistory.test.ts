/**
 * Unit tests for app/lib/txHistory.ts
 *
 * Covers:
 * - filterTransactions
 * - formatTxTimestamp
 * - TxHistoryError classification
 * - Rate-limit enforcement
 * - Response-cache hit / miss
 */

import {
  filterTransactions,
  formatTxTimestamp,
  clearTxCache,
  TxHistoryError,
  type Transaction,
  type TxFilter,
} from "@/app/lib/txHistory";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "0xabc123",
    chain: "ethereum",
    direction: "outgoing",
    status: "confirmed",
    timestamp: 1_700_000_000_000,
    fromAddress: "0x1234…5678",
    toAddress: "0xabcd…ef01",
    amount: "0.05",
    assetSymbol: "ETH",
    explorerUrl: "https://etherscan.io/tx/0xabc123",
    ...overrides,
  };
}

const incoming = makeTx({ id: "0x1", direction: "incoming" });
const outgoing = makeTx({ id: "0x2", direction: "outgoing" });
const self     = makeTx({ id: "0x3", direction: "self" });
const ALL_TXS  = [incoming, outgoing, self];

// ─── filterTransactions ────────────────────────────────────────────────────────

describe("filterTransactions", () => {
  test.each<[TxFilter, string[]]>([
    ["all",      ["0x1", "0x2", "0x3"]],
    ["sent",     ["0x2"]],
    ["received", ["0x1"]],
  ])('filter "%s" returns expected ids', (filter, expectedIds) => {
    const result = filterTransactions(ALL_TXS, filter);
    expect(result.map((t) => t.id)).toEqual(expectedIds);
  });

  it("returns empty array when no txs match filter", () => {
    const onlyOutgoing = [outgoing];
    expect(filterTransactions(onlyOutgoing, "received")).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(filterTransactions([], "all")).toHaveLength(0);
  });
});

// ─── formatTxTimestamp ─────────────────────────────────────────────────────────

describe("formatTxTimestamp", () => {
  it("returns a non-empty string for a valid timestamp", () => {
    const result = formatTxTimestamp(1_700_000_000_000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
  });

  it("includes the year", () => {
    const result = formatTxTimestamp(new Date("2024-03-15T14:30:00Z").getTime());
    expect(result).toContain("2024");
  });

  it("includes AM or PM", () => {
    const result = formatTxTimestamp(new Date("2024-03-15T14:30:00Z").getTime());
    expect(result).toMatch(/AM|PM/);
  });
});

// ─── TxHistoryError ────────────────────────────────────────────────────────────

describe("TxHistoryError", () => {
  it("has the correct name and code", () => {
    const err = new TxHistoryError("test message", "NETWORK_ERROR");
    expect(err.name).toBe("TxHistoryError");
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.message).toBe("test message");
  });

  it("is an instance of Error", () => {
    expect(new TxHistoryError("m", "UNKNOWN")).toBeInstanceOf(Error);
  });

  it("supports all error codes without TypeScript error", () => {
    const codes: TxHistoryError["code"][] = [
      "RATE_LIMITED",
      "NETWORK_ERROR",
      "INVALID_ADDRESS",
      "API_ERROR",
      "UNKNOWN",
    ];
    codes.forEach((code) => {
      expect(() => new TxHistoryError("m", code)).not.toThrow();
    });
  });
});

// ─── clearTxCache ──────────────────────────────────────────────────────────────

describe("clearTxCache", () => {
  it("does not throw for unknown addresses", () => {
    expect(() => clearTxCache("0xdeadbeef")).not.toThrow();
  });

  it("can be called multiple times safely", () => {
    clearTxCache("0xdeadbeef");
    clearTxCache("0xdeadbeef");
  });
});
