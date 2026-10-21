/**
 * @jest-environment node
 *
 * Unit tests for suspicious login detection — Issue (Suspicious Login Detection).
 *
 * Coverage:
 *   - haversineDistance: known city pairs, same-point, antipodal
 *   - isImpossibleTravel: impossible speed, plausible speed, sentinel (0,0),
 *     sessions too close in time, same location
 *   - checkLoginAnomaly: new-country flag, impossible-travel flag, both flags,
 *     no previous session (first login), null geo (private IP), audit event
 *     creation, alert dispatch
 *   - generateRevocationToken / validateRevocationToken: round-trip, expiry,
 *     tamper detection
 *   - sendSuspiciousLoginAlert: email dispatched with correct fields, graceful
 *     failure when mailer returns error
 */

import {
  haversineDistance,
  isImpossibleTravel,
  checkLoginAnomaly,
  IMPOSSIBLE_TRAVEL_SPEED_KMH,
  MIN_TRAVEL_CHECK_GAP_MS,
} from "@/app/lib/loginSecurity";

import {
  generateRevocationToken,
  validateRevocationToken,
  sendSuspiciousLoginAlert,
} from "@/app/lib/loginSecurityEmail";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    userSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/app/api/earnings/shared/mailer", () => ({
  sendTransactionalEmail: jest.fn(),
}));

// Keep logger silent during tests
jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from "@/app/lib/prisma";
import { sendTransactionalEmail } from "@/app/api/earnings/shared/mailer";

const mockFindFirst = prisma.userSession.findFirst as jest.Mock;
const mockUpdate = prisma.userSession.update as jest.Mock;
const mockAuditCreate = prisma.auditLog.create as jest.Mock;
const mockAuditFindFirst = prisma.auditLog.findFirst as jest.Mock;
const mockSendEmail = sendTransactionalEmail as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a Date that is `ms` milliseconds ago. */
function msAgo(ms: number): Date {
  return new Date(Date.now() - ms);
}

/** Returns a Date that is `hours` hours ago. */
function hoursAgo(hours: number): Date {
  return msAgo(hours * 60 * 60 * 1_000);
}

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe("haversineDistance", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistance({ latitude: 51.5, longitude: -0.12 }, { latitude: 51.5, longitude: -0.12 })).toBe(0);
  });

  it("calculates London → Paris (~341 km)", () => {
    // London: 51.5074° N, 0.1278° W
    // Paris:  48.8566° N, 2.3522° E
    const dist = haversineDistance(
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 48.8566, longitude: 2.3522 },
    );
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(355);
  });

  it("calculates New York → London (~5 570 km)", () => {
    const dist = haversineDistance(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 51.5074, longitude: -0.1278 },
    );
    expect(dist).toBeGreaterThan(5_500);
    expect(dist).toBeLessThan(5_650);
  });

  it("calculates Sydney → London (~16 990 km)", () => {
    const dist = haversineDistance(
      { latitude: -33.8688, longitude: 151.2093 },
      { latitude: 51.5074, longitude: -0.1278 },
    );
    expect(dist).toBeGreaterThan(16_900);
    expect(dist).toBeLessThan(17_100);
  });

  it("is commutative — distance(A, B) === distance(B, A)", () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 35.6895, longitude: 139.6917 };
    const ab = haversineDistance(a, b);
    const ba = haversineDistance(b, a);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });
});

// ---------------------------------------------------------------------------
// isImpossibleTravel
// ---------------------------------------------------------------------------

describe("isImpossibleTravel", () => {
  it("flags impossible travel: NY → London in 1 hour (~5 570 km/h)", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 40.7128, longitude: -74.006, createdAt: hoursAgo(1) },
      current:  { latitude: 51.5074, longitude: -0.1278, createdAt: new Date() },
    });
    expect(result.impossible).toBe(true);
    expect(result.impliedSpeedKmh).toBeGreaterThan(IMPOSSIBLE_TRAVEL_SPEED_KMH);
    expect(result.distanceKm).toBeGreaterThan(5_000);
  });

  it("does not flag a realistic drive: Paris → London in 4 hours (~341 km / 85 km/h)", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 48.8566, longitude: 2.3522, createdAt: hoursAgo(4) },
      current:  { latitude: 51.5074, longitude: -0.1278, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
    expect(result.impliedSpeedKmh).toBeLessThan(IMPOSSIBLE_TRAVEL_SPEED_KMH);
  });

  it("does not flag a fast flight that is still under threshold: London → Dubai in 7 hours (~5 500 km / ~785 km/h)", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 51.5074, longitude: -0.1278, createdAt: hoursAgo(7) },
      current:  { latitude: 25.2048, longitude: 55.2708, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
    expect(result.impliedSpeedKmh).toBeLessThan(IMPOSSIBLE_TRAVEL_SPEED_KMH);
  });

  it("returns false (not suspicious) when both coordinates are (0, 0) — unknown from Cloudflare", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 0, longitude: 0, createdAt: hoursAgo(1) },
      current:  { latitude: 0, longitude: 0, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
    expect(result.distanceKm).toBe(0);
  });

  it("returns false when current coordinate is (0, 0)", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 40.7128, longitude: -74.006, createdAt: hoursAgo(1) },
      current:  { latitude: 0, longitude: 0, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
  });

  it("returns false when previous coordinate is (0, 0)", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 0, longitude: 0, createdAt: hoursAgo(1) },
      current:  { latitude: 51.5074, longitude: -0.1278, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
  });

  it("returns false when sessions are too close together (< MIN_TRAVEL_CHECK_GAP_MS)", () => {
    const closeMs = MIN_TRAVEL_CHECK_GAP_MS - 1_000; // 1 second under the threshold
    const result = isImpossibleTravel({
      previous: { latitude: 40.7128, longitude: -74.006, createdAt: msAgo(closeMs) },
      current:  { latitude: 51.5074, longitude: -0.1278, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
  });

  it("returns false when both sessions are at the same location", () => {
    const result = isImpossibleTravel({
      previous: { latitude: 40.7128, longitude: -74.006, createdAt: hoursAgo(2) },
      current:  { latitude: 40.7128, longitude: -74.006, createdAt: new Date() },
    });
    expect(result.impossible).toBe(false);
    expect(result.distanceKm).toBe(0);
  });

  it("exposes distanceKm and impliedSpeedKmh in the result", () => {
    const result = isImpossibleTravel({
      previous: { latitude: -33.8688, longitude: 151.2093, createdAt: hoursAgo(2) },
      current:  { latitude: 51.5074, longitude: -0.1278, createdAt: new Date() },
    });
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.impliedSpeedKmh).toBeGreaterThan(0);
    // Sydney → London in 2 h is obviously impossible
    expect(result.impossible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkLoginAnomaly
// ---------------------------------------------------------------------------

describe("checkLoginAnomaly", () => {
  const BASE_PARAMS = {
    userId: "user-abc",
    userEmail: "alice@example.com",
    newSessionId: "sess-new",
    ipAddress: "203.0.113.5",
    userAgent: "Mozilla/5.0",
  };

  const UK_GEO = {
    country: "GB",
    city: "London",
    latitude: 51.5074,
    longitude: -0.1278,
  };

  const US_GEO = {
    country: "US",
    city: "New York",
    latitude: 40.7128,
    longitude: -74.006,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    // Stub audit log chain
    mockAuditFindFirst.mockResolvedValue(null);
    mockAuditCreate.mockResolvedValue({ id: "audit-1", eventHash: "abc" });
    mockSendEmail.mockResolvedValue({ ok: true });
  });

  it("returns not-flagged when newGeo is null (private IP)", async () => {
    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: null });
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns not-flagged when there is no previous session (first login)", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("flags new_country when login country differs from previous session", async () => {
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "DE",        // Germany
      latitude: 52.52,
      longitude: 13.405,
      createdAt: hoursAgo(48),
      ipAddress: "198.51.100.1",
      userAgent: "Chrome/old",
    });

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("new_country");
    // Session should be marked suspicious
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sess-new" },
      data: { suspicious: true },
    });
    // Alert email should be sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.to).toBe("alice@example.com");
    expect(emailCall.subject).toContain("login");
    expect(emailCall.html).toContain("Revoke this session");
    expect(emailCall.html).toContain("Not you?");
  });

  it("flags impossible_travel when speed between sessions is over threshold", async () => {
    // Previous session in New York, 1 hour ago
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "US",
      latitude: US_GEO.latitude,
      longitude: US_GEO.longitude,
      createdAt: hoursAgo(1),
      ipAddress: "203.0.113.1",
      userAgent: "Chrome",
    });

    // New session in London (same country code swap to isolate travel check
    // we use GB so it also triggers new_country, but the key assertion is travel)
    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("impossible_travel");
    expect(result.distanceKm).toBeGreaterThan(5_000);
    expect(result.impliedSpeedKmh).toBeGreaterThan(IMPOSSIBLE_TRAVEL_SPEED_KMH);
  });

  it("flags both new_country AND impossible_travel simultaneously", async () => {
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "AU",        // Australia
      latitude: -33.8688,
      longitude: 151.2093,
      createdAt: hoursAgo(2),
      ipAddress: "203.0.113.2",
      userAgent: "Safari",
    });

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("new_country");
    expect(result.reasons).toContain("impossible_travel");
  });

  it("does NOT flag when country is the same and travel speed is plausible", async () => {
    // Both sessions in the UK, cities 2 h apart by train
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "GB",
      latitude: 53.4808,   // Manchester
      longitude: -2.2426,
      createdAt: hoursAgo(3),
      ipAddress: "198.51.100.3",
      userAgent: "Firefox",
    });

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO }); // London

    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates an audit event with action auth.suspicious_login when flagged", async () => {
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "CN",
      latitude: 39.9042,
      longitude: 116.4074,
      createdAt: hoursAgo(1),
      ipAddress: "1.2.3.4",
      userAgent: "Chrome",
    });

    await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    // auditLog.create is called with auth.suspicious_login
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "auth.suspicious_login",
          status: "failure",
          resourceId: "sess-new",
        }),
      }),
    );
  });

  it("returns not-flagged (does not throw) when DB lookup throws", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB down"));

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    // checkLoginAnomaly swallows errors — login must not be blocked
    expect(result.flagged).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("still returns flagged=true even when alert email delivery fails", async () => {
    mockFindFirst.mockResolvedValue({
      id: "sess-old",
      country: "JP",
      latitude: 35.6895,
      longitude: 139.6917,
      createdAt: hoursAgo(1),
      ipAddress: "5.6.7.8",
      userAgent: "Edge",
    });
    mockSendEmail.mockResolvedValue({ ok: false, error: "SMTP error" });

    const result = await checkLoginAnomaly({ ...BASE_PARAMS, newGeo: UK_GEO });

    // flagged is still set even if the email failed
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("new_country");
  });
});

// ---------------------------------------------------------------------------
// generateRevocationToken / validateRevocationToken
// ---------------------------------------------------------------------------

describe("generateRevocationToken / validateRevocationToken", () => {
  const SESSION_ID = "sess-cuid-123";

  it("produces a non-empty base64url string", () => {
    const token = generateRevocationToken(SESSION_ID);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    // base64url alphabet: A-Z a-z 0-9 - _  (no + / =)
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("round-trips: validateRevocationToken returns the original sessionId", () => {
    const token = generateRevocationToken(SESSION_ID);
    const result = validateRevocationToken(token);
    expect(result).toBe(SESSION_ID);
  });

  it("returns null for a tampered token (bit flipped in signature)", () => {
    const token = generateRevocationToken(SESSION_ID);
    // Flip a character near the end
    const chars = token.split("");
    const lastIdx = chars.length - 1;
    chars[lastIdx] = chars[lastIdx] === "A" ? "B" : "A";
    const tampered = chars.join("");
    expect(validateRevocationToken(tampered)).toBeNull();
  });

  it("returns null for a completely invalid string", () => {
    expect(validateRevocationToken("not-a-valid-token")).toBeNull();
    expect(validateRevocationToken("")).toBeNull();
  });

  it("returns null for an expired token", () => {
    // Mock Date.now to generate a token that already expired
    const realNow = Date.now;
    // Generate token with expiry in the past by back-dating its creation
    const pastMs = Date.now() - 49 * 60 * 60 * 1_000; // 49 h ago (TTL is 48 h)
    Date.now = jest.fn(() => pastMs);
    const expiredToken = generateRevocationToken(SESSION_ID);
    Date.now = realNow;

    expect(validateRevocationToken(expiredToken)).toBeNull();
  });

  it("two tokens for the same session have different signatures (different expiry timestamps)", async () => {
    const token1 = generateRevocationToken(SESSION_ID);
    // Tiny delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 5));
    const token2 = generateRevocationToken(SESSION_ID);
    expect(token1).not.toBe(token2);
    // Both are still valid
    expect(validateRevocationToken(token1)).toBe(SESSION_ID);
    expect(validateRevocationToken(token2)).toBe(SESSION_ID);
  });
});

// ---------------------------------------------------------------------------
// sendSuspiciousLoginAlert
// ---------------------------------------------------------------------------

describe("sendSuspiciousLoginAlert", () => {
  const BASE = {
    userEmail: "bob@example.com",
    sessionId: "sess-xyz",
    ipAddress: "198.51.100.42",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    country: "US",
    city: "San Francisco",
    reasons: ["new_country"] as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue({ ok: true });
  });

  it("calls sendTransactionalEmail with correct recipient and subject", async () => {
    await sendSuspiciousLoginAlert({ ...BASE, reasons: ["new_country"] });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("bob@example.com");
    expect(call.subject).toMatch(/login/i);
  });

  it("email HTML includes location, IP, device, and revoke link", async () => {
    await sendSuspiciousLoginAlert({ ...BASE, reasons: ["new_country"] });

    const { html, text } = mockSendEmail.mock.calls[0][0];
    expect(html).toContain("San Francisco");
    expect(html).toContain("US");
    expect(html).toContain("198.51.100.42");
    expect(html).toContain("Mozilla/5.0");
    expect(html).toContain("Revoke this session");
    expect(html).toContain("sess-xyz");

    // Plain text also contains the revoke URL
    expect(text).toContain("sess-xyz");
    expect(text).toContain("198.51.100.42");
  });

  it("email mentions new_country reason", async () => {
    await sendSuspiciousLoginAlert({ ...BASE, reasons: ["new_country"] });
    const { html } = mockSendEmail.mock.calls[0][0];
    expect(html).toContain("new country");
  });

  it("email mentions impossible_travel reason with distance and speed", async () => {
    await sendSuspiciousLoginAlert({
      ...BASE,
      reasons: ["impossible_travel"],
      distanceKm: 9_500,
      impliedSpeedKmh: 9_500,
    });
    const { html } = mockSendEmail.mock.calls[0][0];
    expect(html).toContain("Impossible travel");
    expect(html).toContain("9,500");
  });

  it("returns false and does not throw when mailer returns error", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "Rate limited" });

    const result = await sendSuspiciousLoginAlert({ ...BASE, reasons: ["new_country"] });
    expect(result).toBe(false);
  });

  it("returns true on successful delivery", async () => {
    const result = await sendSuspiciousLoginAlert({ ...BASE, reasons: ["new_country"] });
    expect(result).toBe(true);
  });

  it("HTML does not contain unescaped user-controlled data (XSS guard)", async () => {
    const xssPayload = '<script>alert("xss")</script>';
    await sendSuspiciousLoginAlert({
      ...BASE,
      city: xssPayload,
      userAgent: xssPayload,
    });
    const { html } = mockSendEmail.mock.calls[0][0];
    // Raw script tags must not appear in the rendered HTML
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
