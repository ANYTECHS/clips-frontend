/**
 * Pagination boundary tests for getEarningsReport and /api/earnings
 * Covers: first page, last page, empty results, page clamping
 */

import { getEarningsReport } from "@/app/lib/mockApi";

// Bypass rate limiter by calling the unwrapped function via the rateLimiter wrapper
// The mock just calls through synchronously

jest.mock("@/app/lib/rateLimiter", () => ({
  rateLimiter: (fn: any) => fn,
}));

// Re-import after mock
let getReport: typeof getEarningsReport;

beforeAll(async () => {
  jest.resetModules();
  jest.mock("@/app/lib/rateLimiter", () => ({
    rateLimiter: (fn: any) => fn,
  }));
  const mod = await import("@/app/lib/mockApi");
  getReport = mod.getEarningsReport as any;
});

describe("getEarningsReport — pagination", () => {
  it("first page returns pageSize items and correct pagination metadata", async () => {
    const result = await getReport("user1", { page: 1, pageSize: 10 });

    expect(result.transactions).toHaveLength(10);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(10);
    expect(result.pagination.total).toBe(55);
    expect(result.pagination.totalPages).toBe(6); // ceil(55/10)
  });

  it("last page returns the remaining items", async () => {
    // 55 items, pageSize=10 → page 6 has 5 items
    const result = await getReport("user1", { page: 6, pageSize: 10 });

    expect(result.transactions).toHaveLength(5);
    expect(result.pagination.page).toBe(6);
    expect(result.pagination.totalPages).toBe(6);
  });

  it("page beyond total is clamped to last page", async () => {
    const result = await getReport("user1", { page: 999, pageSize: 20 });

    expect(result.pagination.page).toBeLessThanOrEqual(result.pagination.totalPages);
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it("default page=1, pageSize=20 returns first 20 items", async () => {
    const result = await getReport("user1");

    expect(result.transactions).toHaveLength(20);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
    expect(result.pagination.totalPages).toBe(3); // ceil(55/20)
  });

  it("page 2 returns next slice of items", async () => {
    const page1 = await getReport("user1", { page: 1, pageSize: 20 });
    const page2 = await getReport("user1", { page: 2, pageSize: 20 });

    // Pages must not overlap (different IDs)
    const ids1 = new Set(page1.transactions.map((t) => t.id));
    const ids2 = new Set(page2.transactions.map((t) => t.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("summary totals are computed over all transactions, not just the current page", async () => {
    // A page of 5 items cannot have a total that equals only those 5 items
    // because the total is the sum of all 55 transactions.
    const result = await getReport("user1", { page: 1, pageSize: 5 });

    const pageTotal = result.transactions.reduce((sum, t) => sum + t.amount, 0);
    const reportedTotal = parseFloat(result.summary.total);

    // The reported total must be greater than just the 5 items on this page
    expect(reportedTotal).toBeGreaterThan(pageTotal);

    // And the pagination reflects the full 55
    expect(result.pagination.total).toBe(55);
  });
});

describe("getEarningsReport — edge cases", () => {
  it("pageSize=1 returns exactly 1 transaction per page", async () => {
    const result = await getReport("user1", { page: 1, pageSize: 1 });

    expect(result.transactions).toHaveLength(1);
    expect(result.pagination.totalPages).toBe(55);
  });

  it("pageSize larger than total returns all items on page 1", async () => {
    const result = await getReport("user1", { page: 1, pageSize: 200 });

    expect(result.transactions).toHaveLength(55);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("pagination metadata has consistent shape", async () => {
    const result = await getReport("user1", { page: 2, pageSize: 15 });

    expect(result.pagination).toMatchObject({
      page: 2,
      pageSize: 15,
      total: 55,
      totalPages: 4, // ceil(55/15)
    });
  });
});
