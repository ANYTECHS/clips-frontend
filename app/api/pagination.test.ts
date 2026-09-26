import { paginateItems, parsePaginationParams } from "./pagination";

describe("pagination helpers", () => {
  it("caps page size and returns metadata", () => {
    const params = parsePaginationParams(new URLSearchParams("page=2&pageSize=500"), 50);
    const result = paginateItems([1, 2, 3, 4, 5, 6], params);

    expect(params).toEqual({ page: 2, pageSize: 50 });
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.meta).toMatchObject({
      page: 1,
      pageSize: 50,
      total: 6,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it("uses safe defaults for invalid query values", () => {
    const params = parsePaginationParams(new URLSearchParams("page=bad&pageSize=-1"));
    const result = paginateItems(["a", "b", "c"], params);

    expect(params).toEqual({ page: 1, pageSize: 20 });
    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.meta.total).toBe(3);
  });
});
