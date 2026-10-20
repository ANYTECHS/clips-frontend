/** @jest-environment node */

import fc from "fast-check";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/notifications/route";

const SEED = Number(process.env.FC_SEED ?? 1277);

describe("API route input fuzz properties", () => {
  it("returns a client error or success for arbitrary JSON, never a server error", async () => {
    try {
      await fc.assert(
        fc.asyncProperty(fc.jsonValue(), async (payload) => {
          const request = new NextRequest("http://localhost:3000/api/notifications", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const response = await POST(request);
          expect(response.status).toBeLessThan(500);
        }),
        { numRuns: 1_000, seed: SEED + 6 },
      );
    } catch (error) {
      console.error(`[fast-check] api-route-json seed=${SEED + 6}`);
      throw error;
    }
  });

  it("handles randomized pagination and user filters without server errors", async () => {
    try {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ maxLength: 200 }),
          fc.integer({ min: -1_000, max: 1_000_000 }),
          fc.integer({ min: -1_000, max: 1_000_000 }),
          async (userId, page, pageSize) => {
            const query = new URLSearchParams({ userId, page: String(page), pageSize: String(pageSize) });
            const response = await GET(
              new NextRequest(`http://localhost:3000/api/notifications?${query}`),
            );
            expect(response.status).toBeLessThan(500);
          },
        ),
        { numRuns: 1_000, seed: SEED + 7 },
      );
    } catch (error) {
      console.error(`[fast-check] api-route-pagination seed=${SEED + 7}`);
      throw error;
    }
  });
});
