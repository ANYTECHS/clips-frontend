/** @jest-environment node */

import { NextResponse } from "next/server";
import { transformResponse } from "./apiResponse";

describe("transformResponse", () => {
  it("wraps a raw JSON success payload", async () => {
    const response = await transformResponse(NextResponse.json({ result: "ok" }), {
      requestId: "request-1",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { result: "ok" },
      error: null,
      meta: { requestId: "request-1" },
    });
  });

  it("normalizes a raw JSON error payload", async () => {
    const response = await transformResponse(
      NextResponse.json({ error: "Missing item", code: "NOT_FOUND" }, { status: 404 })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: "Missing item",
      code: "NOT_FOUND",
      meta: { timestamp: expect.any(String) },
    });
  });

  it("preserves an existing envelope and non-JSON responses", async () => {
    const envelope = NextResponse.json({ data: { id: "1" }, error: null });
    const transformedEnvelope = await transformResponse(envelope, { requestId: "request-2" });
    const empty = new NextResponse(null, { status: 204 });
    const transformedEmpty = await transformResponse(empty);

    await expect(transformedEnvelope.json()).resolves.toMatchObject({
      data: { id: "1" },
      error: null,
      meta: { requestId: "request-2" },
    });
    expect(transformedEmpty).toBe(empty);
  });
});
