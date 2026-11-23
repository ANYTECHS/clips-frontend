// Issue #1248 — cursor pagination helper tests.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  InvalidCursorError,
  clampLimit,
  decodeCursor,
  encodeCursor,
  isPaginatedListPath,
  normalizeListSearchParams,
  paginate,
  parsePaginationParams,
  toPaginatedResponse,
} from "./pagination";

type Row = { id: number; createdAt: string };

// 50 rows sorted newest first (the default `desc` direction).
const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
  id: 50 - i,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 50 - i)).toISOString(),
}));

describe("paginate()", () => {
  it("returns the first page with a nextCursor", () => {
    const page = paginate(rows, null, 20);
    expect(page.items).toHaveLength(20);
    expect(page.items[0].id).toBe(50);
    expect(page.items[19].id).toBe(31);
    expect(page.hasMore).toBe(true);
    expect(typeof page.nextCursor).toBe("string");
  });

  it("returns a middle page that continues after the cursor", () => {
    const first = paginate(rows, null, 20);
    const middle = paginate(rows, first.nextCursor, 20);
    expect(middle.items).toHaveLength(20);
    expect(middle.items[0].id).toBe(30);
    expect(middle.items[19].id).toBe(11);
    expect(middle.hasMore).toBe(true);
    expect(middle.nextCursor).not.toBe(first.nextCursor);
  });

  it("returns the last page with hasMore=false and no cursor", () => {
    const first = paginate(rows, null, 20);
    const middle = paginate(rows, first.nextCursor, 20);
    const last = paginate(rows, middle.nextCursor, 20);
    expect(last.items).toHaveLength(10);
    expect(last.items[9].id).toBe(1);
    expect(last.hasMore).toBe(false);
    expect(last.nextCursor).toBeNull();
  });

  it("does not repeat or skip items across pages", () => {
    const seen: number[] = [];
    let cursor: string | null = null;
    do {
      const page = paginate(rows, cursor, 7);
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(rows.map((r) => r.id));
  });

  it("breaks ties on the sort field using the id", () => {
    const sameTime = "2026-01-01T00:00:00.000Z";
    const tied = [3, 2, 1].map((id) => ({ id, createdAt: sameTime }));
    const first = paginate(tied, null, 2);
    const second = paginate(tied, first.nextCursor, 2);
    expect(first.items.map((r) => r.id)).toEqual([3, 2]);
    expect(second.items.map((r) => r.id)).toEqual([1]);
  });

  it("supports ascending order and custom sort fields", () => {
    const asc = [1, 2, 3, 4].map((id) => ({ id, score: id * 10 }));
    const first = paginate(asc, null, 2, { sortField: "score", direction: "asc" });
    const second = paginate(asc, first.nextCursor, 2, { sortField: "score", direction: "asc" });
    expect(second.items.map((r) => r.id)).toEqual([3, 4]);
    expect(second.hasMore).toBe(false);
  });

  it("throws InvalidCursorError for an invalid cursor", () => {
    expect(() => paginate(rows, "not a cursor!", 20)).toThrow(InvalidCursorError);
    expect(() => paginate(rows, encodeCursorRaw("{\"foo\":1}"), 20)).toThrow(InvalidCursorError);
    expect(() => paginate(rows, encodeCursorRaw("[]"), 20)).toThrow(InvalidCursorError);
    expect(() => paginate(rows, "e30", 20)).toThrow(InvalidCursorError); // "{}"
  });

  it("clamps the page size to MAX_LIMIT", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: 250 - i, createdAt: 250 - i }));
    expect(paginate(many, null, 1000).items).toHaveLength(MAX_LIMIT);
  });
});

describe("cursor encoding", () => {
  it("is opaque base64url and round-trips the sort value + id", () => {
    const cursor = encodeCursor({ v: 1700000000000, id: "clip_42" });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ v: 1700000000000, id: "clip_42" });
  });
});

describe("limit clamping", () => {
  it("defaults to DEFAULT_LIMIT when missing or invalid", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(null)).toBe(DEFAULT_LIMIT);
    expect(clampLimit("")).toBe(DEFAULT_LIMIT);
    expect(clampLimit("abc")).toBe(DEFAULT_LIMIT);
  });

  it("clamps to [1, MAX_LIMIT]", () => {
    expect(clampLimit("0")).toBe(1);
    expect(clampLimit("-5")).toBe(1);
    expect(clampLimit("101")).toBe(MAX_LIMIT);
    expect(clampLimit(50)).toBe(50);
  });

  it("is applied by parsePaginationParams and normalizeListSearchParams", () => {
    expect(parsePaginationParams(new URLSearchParams("limit=500")).limit).toBe(MAX_LIMIT);
    const normalized = normalizeListSearchParams(new URLSearchParams("status=done"));
    expect(normalized.get("limit")).toBe(String(DEFAULT_LIMIT));
    expect(normalized.get("status")).toBe("done");
    expect(() => normalizeListSearchParams(new URLSearchParams("cursor=%%%"))).toThrow(
      InvalidCursorError,
    );
  });
});

describe("response envelope and endpoint registry", () => {
  it("wraps a page as { data, pagination }", () => {
    const page = paginate(rows, null, 2);
    expect(toPaginatedResponse(page, rows.length)).toEqual({
      data: page.items,
      pagination: { nextCursor: page.nextCursor, hasMore: true, total: 50 },
    });
    expect(toPaginatedResponse(page).pagination).not.toHaveProperty("total");
  });

  it("recognises the paginated list endpoints", () => {
    expect(isPaginatedListPath("/jobs")).toBe(true);
    expect(isPaginatedListPath("/api/v1/clips")).toBe(true);
    expect(isPaginatedListPath("/wallet/transactions/")).toBe(true);
    expect(isPaginatedListPath("/notifications")).toBe(true);
    expect(isPaginatedListPath("/clips/42")).toBe(false);
  });
});

function encodeCursorRaw(json: string): string {
  return Buffer.from(json, "utf8").toString("base64").replace(/=+$/, "");
}
