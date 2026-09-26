/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
}));

import {
  DEFAULT_API_TIMEOUT_MS,
  withApiMiddleware,
} from "@/app/lib/apiMiddleware";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/test");
}

describe("withApiMiddleware timeout handling", () => {
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.API_TIMEOUT_MS;
  });

  it("returns a 504 timeout response with a stable error code", async () => {
    jest.useFakeTimers();
    const handler = withApiMiddleware(
      () => new Promise<NextResponse>(() => undefined),
      { requireAuth: false, timeoutMs: 25 }
    );

    const responsePromise = handler(request());
    jest.advanceTimersByTime(25);
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(response.headers.get("retry-after")).toBe("1");
    await expect(response.json()).resolves.toMatchObject({
      error: "Request timed out",
      code: "TIMEOUT",
    });
  });

  it("uses the configured default timeout", async () => {
    process.env.API_TIMEOUT_MS = "25";
    jest.useFakeTimers();
    const handler = withApiMiddleware(
      () => new Promise<NextResponse>(() => undefined),
      { requireAuth: false }
    );

    const responsePromise = handler(request());
    jest.advanceTimersByTime(25);

    await expect(responsePromise).resolves.toMatchObject({ status: 504 });
  });

  it("allows streaming handlers to opt out", async () => {
    const handler = withApiMiddleware(
      async () => NextResponse.json({ ok: true }),
      { requireAuth: false, timeoutMs: false }
    );

    await expect(handler(request())).resolves.toMatchObject({ status: 200 });
  });

  it("defaults to ten seconds", () => {
    expect(DEFAULT_API_TIMEOUT_MS).toBe(10_000);
  });
});
