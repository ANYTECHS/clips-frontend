/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/csp-report/route";
import { logger } from "@/app/lib/logger";

jest.mock("@/app/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

function makeRequest(body: unknown, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs a classic csp-report payload and returns 204", async () => {
    const res = await POST(
      makeRequest({
        "csp-report": {
          "document-uri": "https://staging.example/transform",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js",
          "original-policy": "default-src 'self'; report-uri /api/csp-report",
        },
      }),
    );

    expect(res.status).toBe(204);
    expect(logger.warn).toHaveBeenCalledWith(
      "[csp-report] Content-Security-Policy violation",
      expect.objectContaining({
        documentUri: "https://staging.example/transform",
        violatedDirective: "script-src",
        blockedUri: "https://evil.example/x.js",
      }),
    );
  });

  it("accepts a Reporting API-style body without the csp-report wrapper", async () => {
    const res = await POST(
      makeRequest({
        documentURI: "https://staging.example/",
        violatedDirective: "img-src",
        blockedURI: "https://cdn.untrusted/img.png",
      }),
    );

    expect(res.status).toBe(204);
    expect(logger.warn).toHaveBeenCalledWith(
      "[csp-report] Content-Security-Policy violation",
      expect.objectContaining({
        documentUri: "https://staging.example/",
        violatedDirective: "img-src",
        blockedUri: "https://cdn.untrusted/img.png",
      }),
    );
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest("{not-json", "application/json"));
    expect(res.status).toBe(400);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
