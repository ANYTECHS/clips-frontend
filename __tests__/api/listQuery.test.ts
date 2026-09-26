/**
 * Tests for the shared list filtering/sorting layer (Issue #949).
 */

import {
  applySort,
  containsAll,
  createListQuerySchema,
  matchesAny,
  matchesQuery,
  MAX_PAGE_SIZE,
  paginate,
  parseRange,
  splitCsv,
  withinDateRange,
  withinRange,
} from "@/app/api/lib/listQuery";

const SORTABLE = ["createdAt", "title", "score"] as const;
const schema = createListQuerySchema(SORTABLE);

describe("createListQuerySchema", () => {
  it("defaults to page 1 and the first sortable field, newest first", () => {
    const parsed = schema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.sort).toBe("createdAt");
    expect(parsed.order).toBe("desc");
  });

  it("rejects a sort field outside the allow-list", () => {
    // The whole point: `sort` names a property read off every record, so an
    // unknown one must be a 400 rather than a silent undefined comparison.
    expect(() => schema.parse({ sort: "userId" })).toThrow();
    expect(() => schema.parse({ sort: "password" })).toThrow();
  });

  it("caps pageSize rather than letting a caller ask for everything", () => {
    expect(() => schema.parse({ pageSize: String(MAX_PAGE_SIZE + 1) })).toThrow();
    expect(schema.parse({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("rejects a page below 1", () => {
    expect(() => schema.parse({ page: "0" })).toThrow();
    expect(() => schema.parse({ page: "-3" })).toThrow();
  });

  it("rejects non-numeric pagination", () => {
    expect(() => schema.parse({ page: "abc" })).toThrow();
    expect(() => schema.parse({ pageSize: "ten" })).toThrow();
  });

  it("normalises dates to ISO and rejects unparseable ones", () => {
    const parsed = schema.parse({ dateFrom: "2026-03-01" });
    expect(parsed.dateFrom).toBe(new Date("2026-03-01").toISOString());

    expect(() => schema.parse({ dateTo: "not-a-date" })).toThrow();
  });

  it("treats empty strings as absent", () => {
    // Query strings routinely carry `?q=&dateFrom=` from an untouched form.
    const parsed = schema.parse({ page: "", pageSize: "", dateFrom: "", q: "" });

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.dateFrom).toBeUndefined();
  });
});

describe("splitCsv", () => {
  it("drops empty segments", () => {
    expect(splitCsv("a,,b, c ")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for absent input", () => {
    expect(splitCsv(null)).toEqual([]);
    expect(splitCsv(undefined)).toEqual([]);
    expect(splitCsv("")).toEqual([]);
  });
});

describe("applySort", () => {
  const rows = [
    { id: "a", score: 50, title: "Banana" },
    { id: "b", score: 90, title: "apple" },
    { id: "c", score: 70, title: "Cherry" },
  ];

  it("sorts numbers in both directions", () => {
    expect(applySort(rows, "score", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(applySort(rows, "score", "desc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts strings case-insensitively", () => {
    // A plain `<` comparison would put "Banana" before "apple".
    expect(applySort(rows, "title", "asc").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input", () => {
    const original = [...rows];
    applySort(rows, "score", "asc");
    expect(rows).toEqual(original);
  });

  it("sorts missing values last in both directions", () => {
    // Ascending with nulls first would put empty records at the top of the
    // list, which is never what someone browsing wants to see.
    const withGaps = [
      { id: "a", score: 50 },
      { id: "b", score: undefined },
      { id: "c", score: 70 },
    ];

    expect(applySort(withGaps, "score", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(applySort(withGaps, "score", "desc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts ISO timestamps chronologically", () => {
    const dated = [
      { id: "a", createdAt: "2026-01-15T00:00:00.000Z" },
      { id: "b", createdAt: "2026-03-01T00:00:00.000Z" },
      { id: "c", createdAt: "2026-02-01T00:00:00.000Z" },
    ];

    expect(applySort(dated, "createdAt", "desc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }));

  it("slices the requested page and reports the pre-pagination total", () => {
    const result = paginate(rows, 2, 10);

    expect(result.items).toHaveLength(10);
    expect(result.items[0]!.id).toBe("10");
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("returns an empty page past the end rather than throwing", () => {
    const result = paginate(rows, 99, 10);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(25);
  });

  it("reports one page for an empty list", () => {
    // `totalPages: 0` renders as "page 1 of 0" in every paginator.
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });
});

describe("parseRange", () => {
  const params = (init: Record<string, string>) => new URLSearchParams(init);

  it("reads both bounds", () => {
    const result = parseRange(params({ durationMin: "10", durationMax: "60" }), "duration");
    expect(result).toEqual({ ok: true, min: 10, max: 60 });
  });

  it("allows an open-ended range", () => {
    expect(parseRange(params({ durationMin: "10" }), "duration")).toEqual({
      ok: true,
      min: 10,
      max: undefined,
    });
  });

  it("rejects an inverted range instead of returning nothing", () => {
    // min > max can only ever match zero records; reporting it beats an empty
    // list the caller reads as "no results".
    const result = parseRange(params({ durationMin: "60", durationMax: "10" }), "duration");
    expect(result.ok).toBe(false);
  });

  it("rejects non-numeric bounds", () => {
    expect(parseRange(params({ scoreMin: "high" }), "score").ok).toBe(false);
  });
});

describe("matchesQuery", () => {
  const clip = { title: "Golden sunset b-roll", style: "Minimalist", tags: ["travel"] };

  it("matches a substring of a string field, case-insensitively", () => {
    expect(matchesQuery(clip, "SUNSET", ["title"])).toBe(true);
  });

  it("matches inside an array field", () => {
    expect(matchesQuery(clip, "trav", ["tags"])).toBe(true);
  });

  it("matches everything when the query is empty", () => {
    expect(matchesQuery(clip, "", ["title"])).toBe(true);
  });

  it("does not match a field that was not listed", () => {
    expect(matchesQuery(clip, "Minimalist", ["title"])).toBe(false);
  });
});

describe("withinDateRange", () => {
  it("includes both bounds", () => {
    expect(withinDateRange("2026-03-01T12:00:00Z", "2026-03-01", "2026-03-31")).toBe(true);
    expect(withinDateRange("2026-03-31T23:59:00Z", "2026-03-01", "2026-03-31")).toBe(true);
  });

  it("excludes outside the range", () => {
    expect(withinDateRange("2026-02-28T00:00:00Z", "2026-03-01", undefined)).toBe(false);
    expect(withinDateRange("2026-04-01T00:00:00Z", undefined, "2026-03-31")).toBe(false);
  });

  it("matches everything when no bounds are given", () => {
    expect(withinDateRange("2026-03-01T00:00:00Z")).toBe(true);
  });
});

describe("withinRange", () => {
  it("is inclusive on both ends", () => {
    expect(withinRange(10, 10, 20)).toBe(true);
    expect(withinRange(20, 10, 20)).toBe(true);
    expect(withinRange(21, 10, 20)).toBe(false);
  });

  it("excludes a non-numeric value when a bound is set", () => {
    expect(withinRange(null, 10, undefined)).toBe(false);
  });

  it("matches everything when no bounds are set", () => {
    expect(withinRange(null)).toBe(true);
  });
});

describe("matchesAny", () => {
  it("treats an empty allow-list as no filter", () => {
    // An absent query parameter must not silently empty the list.
    expect(matchesAny("pending", [])).toBe(true);
  });

  it("matches only listed values", () => {
    expect(matchesAny("pending", ["pending", "listed"])).toBe(true);
    expect(matchesAny("history", ["pending", "listed"])).toBe(false);
  });
});

describe("containsAll", () => {
  it("requires every tag, so filters narrow rather than widen", () => {
    expect(containsAll(["travel", "timelapse", "drone"], ["travel", "timelapse"])).toBe(true);
    expect(containsAll(["travel"], ["travel", "timelapse"])).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(containsAll(["Travel"], ["travel"])).toBe(true);
  });

  it("treats an empty requirement as no filter", () => {
    expect(containsAll(undefined, [])).toBe(true);
  });

  it("does not match a record with no tags when tags are required", () => {
    expect(containsAll(undefined, ["travel"])).toBe(false);
  });
});
