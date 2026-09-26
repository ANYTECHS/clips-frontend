/**
 * Unit tests for POST /api/recovery/initiate
 */

import { NextRequest } from "next/server";
import { POST } from "../initiate/route";
import {
  getRecoveryRepository,
  __resetRecoveryRepository,
  type RecoveryConfig,
} from "../shared/recoveryStore";
import * as mailer from "../shared/mailer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/recovery/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleConfig: RecoveryConfig = {
  email: "owner@example.com",
  threshold: 2,
  guardians: [
    { email: "guardian1@example.com", shareId: "share-1" },
    { email: "guardian2@example.com", shareId: "share-2" },
    { email: "guardian3@example.com", shareId: "share-3" },
  ],
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(async () => {
  __resetRecoveryRepository();
  jest.spyOn(mailer, "sendGuardianApprovalEmail").mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/recovery/initiate", () => {
  test("returns 422 for missing email", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  test("returns 422 for invalid email format", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  test("returns 400 for non-JSON content-type", async () => {
    const req = new NextRequest("http://localhost:3000/api/recovery/initiate", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "email=owner@example.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 404 when no recovery config exists", async () => {
    const res = await POST(makeRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/no social recovery configuration/i);
  });

  test("creates session and returns correct shape on success", async () => {
    const repo = getRecoveryRepository();
    await repo.setConfig(sampleConfig);

    const res = await POST(makeRequest({ email: "owner@example.com" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.sessionId).toBeDefined();
    expect(json.guardians).toEqual([
      "guardian1@example.com",
      "guardian2@example.com",
      "guardian3@example.com",
    ]);
    expect(json.threshold).toBe(2);
    expect(json.guardianCount).toBe(3);
  });

  test("emails all guardians on success", async () => {
    const repo = getRecoveryRepository();
    await repo.setConfig(sampleConfig);

    await POST(makeRequest({ email: "owner@example.com" }));

    expect(mailer.sendGuardianApprovalEmail).toHaveBeenCalledTimes(3);
    const calls = (mailer.sendGuardianApprovalEmail as jest.Mock).mock.calls;
    const emailedTo = calls.map((c: any[]) => c[0].to);
    expect(emailedTo).toContain("guardian1@example.com");
    expect(emailedTo).toContain("guardian2@example.com");
    expect(emailedTo).toContain("guardian3@example.com");
  });

  test("session is persisted in the store", async () => {
    const repo = getRecoveryRepository();
    await repo.setConfig(sampleConfig);

    const res = await POST(makeRequest({ email: "owner@example.com" }));
    const { sessionId } = await res.json();

    const session = await repo.getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.email).toBe("owner@example.com");
    expect(session!.guardians).toHaveLength(3);
    expect(session!.guardians.every((g) => !g.approved)).toBe(true);
  });

  test("does not fail when guardian email delivery fails", async () => {
    jest
      .spyOn(mailer, "sendGuardianApprovalEmail")
      .mockRejectedValue(new Error("SMTP error"));

    const repo = getRecoveryRepository();
    await repo.setConfig(sampleConfig);

    const res = await POST(makeRequest({ email: "owner@example.com" }));
    expect(res.status).toBe(200);
  });
});
