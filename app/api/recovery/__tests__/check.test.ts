/**
 * Unit tests for GET /api/recovery/check
 */

import { NextRequest } from "next/server";
import { GET } from "../check/route";
import {
  getRecoveryRepository,
  __resetRecoveryRepository,
  type RecoverySession,
} from "../shared/recoveryStore";
import * as shamirRecovery from "@/app/lib/shamirRecovery";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(sessionId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/recovery/check?sessionId=${encodeURIComponent(sessionId)}`
  );
}

const SESSION_ID = "check-session-id";

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
    expiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  __resetRecoveryRepository();
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/recovery/check", () => {
  test("returns 400 when sessionId query param is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/recovery/check");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/sessionId/i);
  });

  test("returns 404 for unknown sessionId", async () => {
    const res = await GET(makeRequest("nonexistent-session"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/invalid or expired session/i);
  });

  test("returns 410 for an expired session", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession({ expiresAt: Date.now() - 1 }));

    const res = await GET(makeRequest(SESSION_ID));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toMatch(/expired/i);
  });

  test("returns approval status when threshold is NOT met", async () => {
    const repo = getRecoveryRepository();
    // Only one guardian approved — threshold is 2
    await repo.createSession(
      makeSampleSession({
        guardians: [
          { email: "guardian1@example.com", approved: true, shareId: "share-1" },
          { email: "guardian2@example.com", approved: false, shareId: "share-2" },
          { email: "guardian3@example.com", approved: false, shareId: "share-3" },
        ],
      })
    );

    const res = await GET(makeRequest(SESSION_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.isRecoverable).toBe(false);
    expect(json.approvedCount).toBe(1);
    expect(json.totalCount).toBe(3);
    expect(json.threshold).toBe(2);
    expect(json.encryptedBackup).toBeNull();
  });

  test("reports recoverable without combining shares server-side", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(
      makeSampleSession({
        guardians: [
          { email: "guardian1@example.com", approved: true, shareId: "share-1" },
          { email: "guardian2@example.com", approved: true, shareId: "share-2" },
          { email: "guardian3@example.com", approved: false, shareId: "share-3" },
        ],
      })
    );
    // Stored shares are guardian-encrypted ciphertext.
    await repo.setShare("share-1", "encrypted-share-1");
    await repo.setShare("share-2", "encrypted-share-2");

    const combineSharesSpy = jest.spyOn(shamirRecovery, "combineShares");

    const res = await GET(makeRequest(SESSION_ID));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isRecoverable).toBe(true);
    expect(json.approvedCount).toBe(2);
    expect(json.encryptedBackup).toBeNull();
    expect(combineSharesSpy).not.toHaveBeenCalled();
  });

  test("returns guardian list with approval status", async () => {
    const repo = getRecoveryRepository();
    await repo.createSession(makeSampleSession());

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();
    expect(Array.isArray(json.guardians)).toBe(true);
    expect(json.guardians).toHaveLength(3);
    json.guardians.forEach((g: { email: string; approved: boolean }) => {
      expect(typeof g.email).toBe("string");
      expect(typeof g.approved).toBe("boolean");
    });
  });
});
