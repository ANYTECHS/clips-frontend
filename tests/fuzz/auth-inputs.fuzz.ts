/** @jest-environment node */

import fc from "fast-check";
import { NextRequest } from "next/server";
import { jwtCallback, sessionCallback } from "@/app/lib/authCallbacks";
import { checkCsrf } from "@/app/lib/csrf";

jest.mock("@/app/lib/userApi", () => ({ fetchOnboardingStep: jest.fn() }));

const SEED = Number(process.env.FC_SEED ?? 1277);

describe("auth input fuzz properties", () => {
  it("handles randomized email, password, and token claims without session corruption", () => {
    try {
      fc.assert(
        fc.asyncProperty(
          fc.emailAddress({ maxLength: 100 }),
          fc.string({ maxLength: 256 }),
          fc.string({ maxLength: 1_024 }),
          async (email, password, tokenValue) => {
            const token = await jwtCallback({
              token: { email, password, accessToken: tokenValue },
              account: null,
            });
            const session = await sessionCallback({
              session: {
                user: { email, name: null },
                expires: "2099-01-01T00:00:00.000Z",
              } as never,
              token,
            });
            expect(session.user?.email).toBe(email);
            expect(session.user?.accessToken).toBe(tokenValue);
          },
        ),
        { numRuns: 1_000, seed: SEED + 4 },
      );
    } catch (error) {
      console.error(`[fast-check] auth-claims seed=${SEED + 4}`);
      throw error;
    }
  });

  it("rejects random non-app origins without throwing", () => {
    process.env.NEXTAUTH_URL = "https://app.example.test";
    try {
      fc.assert(
        fc.property(fc.webUrl(), (origin) => {
          const request = new NextRequest("https://app.example.test/api/test", {
            method: "POST",
            headers: { origin },
          });
          const response = checkCsrf(request);
          if (new URL(origin).origin !== "https://app.example.test") {
            expect(response?.status).toBe(403);
          }
        }),
        { numRuns: 1_000, seed: SEED + 5 },
      );
    } catch (error) {
      console.error(`[fast-check] auth-csrf-origin seed=${SEED + 5}`);
      throw error;
    }
  });
});
