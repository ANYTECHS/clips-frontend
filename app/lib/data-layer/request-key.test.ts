import { createRequestKey, buildUrlWithParams, stableStringify } from "@/app/lib/data-layer";

describe("createRequestKey", () => {
  it("is deterministic for the same method, URL, params, and body", () => {
    const a = createRequestKey({
      method: "GET",
      url: "/api/dashboard",
      params: { range: "7d", sort: "new" },
    });
    const b = createRequestKey({
      method: "get",
      url: "/api/dashboard",
      params: { sort: "new", range: "7d" },
    });
    expect(a).toBe(b);
  });

  it("sorts query parameters already present in the URL", () => {
    const a = createRequestKey({ method: "GET", url: "/api/x?b=2&a=1" });
    const b = createRequestKey({ method: "GET", url: "/api/x?a=1&b=2" });
    expect(a).toBe(b);
  });

  it("distinguishes different URLs", () => {
    expect(createRequestKey({ url: "/api/dashboard" })).not.toBe(
      createRequestKey({ url: "/api/earnings" }),
    );
  });

  it("distinguishes different query parameters", () => {
    expect(
      createRequestKey({ url: "/api/dashboard", params: { range: "a" } }),
    ).not.toBe(
      createRequestKey({ url: "/api/dashboard", params: { range: "b" } }),
    );
  });

  it("distinguishes different request bodies", () => {
    expect(
      createRequestKey({ method: "POST", url: "/clips/post", body: { clipIds: ["a"] } }),
    ).not.toBe(
      createRequestKey({ method: "POST", url: "/clips/post", body: { clipIds: ["b"] } }),
    );
  });

  it("includes the body when it affects identity", () => {
    const key = createRequestKey({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
    });
    expect(key).toContain("body=");
    expect(key).toContain("c1");
  });

  it("omits the body segment when no body is provided", () => {
    expect(createRequestKey({ method: "GET", url: "/api/dashboard" })).not.toContain("body=");
  });
});

describe("stableStringify", () => {
  it("sorts object keys so key order does not change identity", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});

describe("buildUrlWithParams", () => {
  it("merges extra params into a relative URL", () => {
    expect(buildUrlWithParams("/api/dashboard", { range: "7d" })).toBe(
      "/api/dashboard?range=7d",
    );
  });
});
