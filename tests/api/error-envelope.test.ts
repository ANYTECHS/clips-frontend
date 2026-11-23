// Issue #1390 — every API route returns errors as `{ error, message, code? }`
// built with the shared helper in lib/apiResponse.ts.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, it, expect } from "vitest";
import {
  apiError,
  apiJson,
  getApiErrorMessage,
  isApiErrorBody,
  statusLabel,
} from "../../lib/apiResponse";
import { rejectDisallowedOrigin } from "../../lib/cors";
import { REQUEST_ID_HEADER } from "../../lib/requestId";

const ROOT = join(__dirname, "..", "..");
const API_DIR = join(ROOT, "app", "api");

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return findRouteFiles(full);
    return /^route\.(ts|tsx|js)$/.test(entry) ? [full] : [];
  });
}

describe("apiError", () => {
  it("returns the standard envelope", async () => {
    const res = apiError(400, "Missing url parameter.", { code: "MISSING_URL" });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toEqual({
      error: "Bad Request",
      message: "Missing url parameter.",
      code: "MISSING_URL",
    });
    expect(isApiErrorBody(body)).toBe(true);
  });

  it("omits code when none is given", async () => {
    const body = await apiError(404, "Not here.").json();
    expect(body).toEqual({ error: "Not Found", message: "Not here." });
    expect(isApiErrorBody(body)).toBe(true);
  });

  it("labels every status with a non-empty error string", () => {
    for (const status of [400, 401, 403, 404, 409, 415, 418, 429, 500, 502, 503, 599]) {
      expect(statusLabel(status)).toMatch(/\S/);
    }
  });

  it("echoes the request ID header when provided", () => {
    const res = apiError(500, "Boom.", { requestId: "req-12345678" });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("req-12345678");
    expect(apiJson({ ok: true }, { requestId: "req-12345678" }).headers.get(REQUEST_ID_HEADER))
      .toBe("req-12345678");
  });
});

describe("isApiErrorBody", () => {
  it("rejects legacy and malformed shapes", () => {
    expect(isApiErrorBody("Something failed")).toBe(false);
    expect(isApiErrorBody({ error: "Something failed" })).toBe(false);
    expect(isApiErrorBody({ statusCode: 503, message: "Down" })).toBe(false);
    expect(isApiErrorBody({ error: "Bad Request", message: "" })).toBe(false);
    expect(isApiErrorBody({ error: "Bad Request", message: "x", code: 42 })).toBe(false);
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody([])).toBe(false);
  });
});

describe("getApiErrorMessage", () => {
  it("prefers message, then error, then the fallback", () => {
    expect(getApiErrorMessage({ error: "Bad Request", message: "Missing url." }, "x")).toBe("Missing url.");
    expect(getApiErrorMessage({ error: "Legacy error" }, "x")).toBe("Legacy error");
    expect(getApiErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});

describe("CORS rejection", () => {
  it("uses the standard envelope", async () => {
    const res = rejectDisallowedOrigin({
      headers: new Headers({ origin: "https://evil.example.com" }),
    });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(isApiErrorBody(await res!.json())).toBe(true);
  });
});

describe("API routes use the shared helper", () => {
  const routeFiles = findRouteFiles(API_DIR);

  it("finds route files", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  // Hand-rolled JSON bodies are how `{ error }`-only and `{ statusCode,
  // message }` responses crept in — routes must go through apiJson/apiError.
  const FORBIDDEN: Array<[RegExp, string]> = [
    [/NextResponse\.json\s*\(/, "NextResponse.json("],
    [/\bResponse\.json\s*\(/, "Response.json("],
    [/JSON\.stringify\(\s*\{\s*(error|statusCode)\s*:/, "JSON.stringify({ error/statusCode ... })"],
  ];

  for (const file of routeFiles) {
    const name = relative(ROOT, file);
    it(`${name} builds JSON responses with lib/apiResponse`, () => {
      const source = readFileSync(file, "utf8");
      for (const [pattern, label] of FORBIDDEN) {
        expect(pattern.test(source), `${name} uses ${label}; use apiJson()/apiError()`).toBe(false);
      }
    });
  }
});
