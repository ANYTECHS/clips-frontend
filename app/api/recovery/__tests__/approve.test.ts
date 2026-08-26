/**
 * Unit tests for POST /api/recovery/approve
 */

import { NextRequest } from "next/server";
import { POST } from "../approve/route";
import {
  getRecoveryRepository,
  __resetRecoveryRepository,
  type RecoverySession,
} from "../shared/recoveryStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/recovery/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SESSION_ID = "test-session-id";

function makeSampleSession(overrides: Partial<RecoverySession> = {}): RecoverySession {
  return {
    id: SESSION_ID,
    email: "owner@example.com",
    threshold: 2,
    guardians: [
      { email: "guardian1@example.com", approved: false, shareId: "share-1" },
      { email: "guardian2@example.com", approved: false, shareId: "share-2" },
      { email: "guardian3@example.com", approved: false, shareId: "share-3" },
    ],
    expiresAt: Date.now() + 3_600_000, // 1 hour from now
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  __resetRecoveryRepository();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/recovery/approve", () => {
  test("returns 422 for missing sessionId", async () => {
    const res = await POST(makeRequest({ guardianEmail: "g@example.com" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  test("returns 422 for invalid guardianEmail", async () => {
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "not-an-email" })
    );
    expect(res.status).toBe(422);
  });

  test("returns 404 for unknown sessionId", async () => {
    const res = await POST(
      makeRequest({ sessionId: "nonexistent", guardianEmail: "g@example.com" })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/invalid or expired session/i);
  });

  test("returns 410 for an expired session", async () => {
    const repo = getRecoveryRepository();
    const expired = makeSampleSession({ expiresAt: Date.now() - 1000 });
    await repo.createSession(expired);

    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "guardian1@example.com" })
    );
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toMatch(/expired/i);
  });

  test("returns 403 when guardian is not in the session", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "stranger@example.com" })
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/guardian not found/i);
  });

  test("marks guardian as approved and returns updated list", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "guardian1@example.com" })
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    const approved = json.guardians.find(
      (g: { email: string; approved: boolean }) => g.email === "guardian1@example.com"
    );
    expect(approved?.approved).toBe(true);
  });

  test("persists the approval in the store", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "guardian2@example.com" })
    );

    const updated = await repo.getSession(SESSION_ID);
    const g = updated!.guardians.find((g) => g.email === "guardian2@example.com");
    expect(g?.approved).toBe(true);
  });

  test("is idempotent — approving twice keeps guardian approved", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "guardian1@example.com" })
    );
    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "guardian1@example.com" })
    );
    expect(res.status).toBe(200);

    const session = await repo.getSession(SESSION_ID);
    const g = session!.guardians.find((g) => g.email === "guardian1@example.com");
    expect(g?.approved).toBe(true);
  });

  test("email matching is case-insensitive", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    const res = await POST(
      makeRequest({ sessionId: SESSION_ID, guardianEmail: "GUARDIAN1@EXAMPLE.COM" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    const g = json.guardians.find(
      (g: { email: string }) => g.email.toLowerCase() === "guardian1@example.com"
    );
    expect(g?.approved).toBe(true);
  });
});
