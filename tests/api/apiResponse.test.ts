import { describe, it, expect, vi, afterEach } from "vitest";
import {
  success,
  error,
  paginated,
  validationError,
  serverError,
  handleError,
  empty,
  type ApiErrorBody,
  type PaginatedBody,
} from "../../app/api/apiResponse";
import { ApiError } from "../../app/api/apiError";
import { ERROR_CODES, codeForStatus } from "../../app/api/errorCodes";

// Issue #1249 — standard API response shapes.

describe("success()", () => {
  it("returns the data as JSON with status 200 by default", async () => {
    const res = success({ id: 1, title: "clip" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ id: 1, title: "clip" });
  });

  it("honours a custom status", async () => {
    const res = success({ status: "degraded" }, 503);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded" });
  });
});

describe("error()", () => {
  it("returns { error, message, code } with the given status", async () => {
    const res = error("Video not found.", 404, ERROR_CODES.NOT_FOUND);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorBody;
    expect(body).toEqual({
      error: "Not Found",
      message: "Video not found.",
      code: "NOT_FOUND",
    });
  });

  it("derives a default code from the status", async () => {
    const body = (await error("Slow down.", 429).json()) as ApiErrorBody;
    expect(body.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(body.error).toBe("Too Many Requests");
  });

  it("includes details only when provided", async () => {
    const withDetails = (await error("Bad", 400, ERROR_CODES.BAD_REQUEST, {
      details: { reason: "x" },
    }).json()) as ApiErrorBody;
    expect(withDetails.details).toEqual({ reason: "x" });

    const without = (await error("Bad", 400).json()) as ApiErrorBody;
    expect("details" in without).toBe(false);
  });
});

describe("paginated()", () => {
  it("returns items with pagination metadata including totalPages", async () => {
    const res = paginated(["a", "b"], { page: 1, limit: 2, total: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedBody<string>;
    expect(body).toEqual({
      items: ["a", "b"],
      pagination: { page: 1, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it("reports zero pages when limit is zero", async () => {
    const body = (await paginated([], { page: 1, limit: 0, total: 0 }).json()) as PaginatedBody<never>;
    expect(body.pagination.totalPages).toBe(0);
  });
});

describe("validationError()", () => {
  it("returns 400 with field-level errors in details", async () => {
    const res = validationError({ url: "Missing url parameter." });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.details).toEqual({ fields: { url: "Missing url parameter." } });
  });
});

describe("serverError() / handleError()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { Sentry?: unknown }).Sentry;
  });

  it("returns a generic 500 and reports the full error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const captureException = vi.fn();
    (globalThis as { Sentry?: unknown }).Sentry = { captureException };

    const boom = new Error("db password is hunter2");
    const res = serverError(boom, "[test]");
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(body.message).not.toContain("hunter2");
    expect(log).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(boom, { extra: { context: "[test]" } });
  });

  it("keeps the status, code and details of an ApiError", async () => {
    const res = handleError(
      new ApiError("Nope.", 403, ERROR_CODES.ORIGIN_NOT_ALLOWED, { origin: "x" })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Forbidden",
      message: "Nope.",
      code: "ORIGIN_NOT_ALLOWED",
      details: { origin: "x" },
    });
  });

  it("turns unknown throwables into a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleError("weird");
    expect(res.status).toBe(500);
  });
});

describe("empty()", () => {
  it("returns a bodiless response with the given status and headers", async () => {
    const res = empty(304, { headers: { etag: '"abc"' } });
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"abc"');
    expect(res.body).toBeNull();
  });
});

describe("codeForStatus()", () => {
  it("maps common statuses to codes", () => {
    expect(codeForStatus(401)).toBe("AUTH_REQUIRED");
    expect(codeForStatus(404)).toBe("NOT_FOUND");
    expect(codeForStatus(503)).toBe("SERVICE_UNAVAILABLE");
    expect(codeForStatus(599)).toBe("INTERNAL_ERROR");
  });
});
