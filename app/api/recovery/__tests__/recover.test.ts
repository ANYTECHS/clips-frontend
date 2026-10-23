/**
 * Unit tests for POST /api/recovery/recover
 */

import { NextRequest } from "next/server";

import { createEmailVerificationToken } from "@/app/lib/emailVerification";
import { splitSecret } from "@/app/lib/shamirRecovery";

import { POST } from "../recover/route";
import {
  __resetRecoveryRepository,
  getRecoveryRepository,
  type RecoverySession,
} from "../shared/recoveryStore";

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

const SESSION_ID = "recover-session-id";
const OWNER = "owner@example.com";
const SECRET = "password-encrypted-backup";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/recovery/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSession(overrides: Partial<RecoverySession> = {}): RecoverySession {
  return {
    id: SESSION_ID,
    email: OWNER,
    threshold: 3,
    guardians: [1, 2, 3, 4, 5].map((n) => ({
      email: `guardian${n}@example.com`,
      approved: false,
      shareId: `share-${n}`,
    })),
    expiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

const token = () => createEmailVerificationToken(SESSION_ID, OWNER);

beforeEach(async () => {
  __resetRecoveryRepository();
  await getRecoveryRepository().createSession(makeSession());
});

describe("POST /api/recovery/recover", () => {
  test("combines threshold shares and returns the recovered key", async () => {
    const shares = splitSecret(SECRET, 5, 3);
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: token(),
        shares: [shares[0], shares[2], shares[4]],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recoveredKey).toBe(SECRET);
  });

  test("rejects fewer shares than the threshold", async () => {
    const shares = splitSecret(SECRET, 5, 3);
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: token(),
        shares: [shares[0], shares[1]],
      })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/insufficient shares/i);
  });

  test("rejects duplicate shares that do not meet the threshold", async () => {
    const shares = splitSecret(SECRET, 5, 3);
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: token(),
        shares: [shares[0], shares[0], shares[1]],
      })
    );
    expect(res.status).toBe(422);
  });

  test("requires an email verification token bound to the session", async () => {
    const shares = splitSecret(SECRET, 5, 3);
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: createEmailVerificationToken("other-session", OWNER),
        shares: shares.slice(0, 3),
      })
    );
    expect(res.status).toBe(403);
  });

  test("rejects a token issued for a different email", async () => {
    const shares = splitSecret(SECRET, 5, 3);
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: createEmailVerificationToken(SESSION_ID, "attacker@example.com"),
        shares: shares.slice(0, 3),
      })
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for an unknown session", async () => {
    const res = await POST(
      makeRequest({ sessionId: "missing", verificationToken: token(), shares: ["a", "b"] })
    );
    expect(res.status).toBe(404);
  });

  test("returns 422 for malformed shares", async () => {
    const res = await POST(
      makeRequest({
        sessionId: SESSION_ID,
        verificationToken: token(),
        shares: ["not-a-share", "also-bad", "nope"],
      })
    );
    expect(res.status).toBe(422);
  });
});
