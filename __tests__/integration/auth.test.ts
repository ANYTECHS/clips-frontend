import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { jwtCallback, sessionCallback } from "@/app/lib/authCallbacks";
import {
  createTrackedSession,
  revokeSession,
  rotateSession,
  validateTrackedSession,
} from "@/app/lib/sessionSecurity";
import { getMiddlewareRedirectTarget } from "@/app/lib/authRedirect";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { checkCsrf } from "@/app/lib/csrf";
import { fetchOnboardingStep } from "@/app/lib/userApi";

jest.mock("@/app/lib/userApi", () => ({
  fetchOnboardingStep: jest.fn().mockResolvedValue(3),
}));

const TEST_EMAIL = "auth-integration@clips.test";

function makeRequest(url = "http://localhost:3000/api/auth/test") {
  return new NextRequest(url, {
    headers: { origin: "http://localhost:3000", "x-forwarded-for": "127.0.0.1" },
  });
}

describe("auth integration against the test database", () => {
  let userId: string;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("Auth integration tests require the isolated TEST_DATABASE_URL.");
    }
    const user = await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: { name: "OAuth Integration User" },
      create: { email: TEST_EMAIL, name: "OAuth Integration User", onboardingStep: 3 },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await prisma.userSession.deleteMany({ where: { userId } });
    jest.clearAllMocks();
    (fetchOnboardingStep as jest.Mock).mockResolvedValue(3);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  it.each([
    ["google", { sub: "google-user", email: TEST_EMAIL, name: "Google Test" }],
    ["apple", { sub: "apple-user", email: TEST_EMAIL, name: "Apple Test" }],
  ])("accepts a mocked %s OAuth callback and establishes a session", async (provider, profile) => {
    const token = await jwtCallback({
      token: {},
      account: { provider, type: "oauth", providerAccountId: profile.sub, access_token: "mock-oauth-token" },
      user: { id: userId, email: profile.email, name: profile.name },
      profile,
    });
    const session = await sessionCallback({
      session: { user: { email: profile.email, name: profile.name }, expires: "2099-01-01T00:00:00.000Z" },
      token: { ...token, sub: userId },
    });

    expect(token.provider).toBe(provider);
    expect(session.user?.id).toBe(userId);
    expect(session.user?.provider).toBe(provider);
    expect(fetchOnboardingStep).toHaveBeenCalledTimes(1);
  });

  it("creates, validates, rotates, and revokes persisted sessions for logout", async () => {
    const first = await createTrackedSession(userId, makeRequest());
    expect((await validateTrackedSession(first.sessionToken)).valid).toBe(true);

    const rotated = await rotateSession(first.sessionToken, userId, makeRequest());
    expect(rotated.sessionToken).not.toBe(first.sessionToken);
    expect(await validateTrackedSession(first.sessionToken)).toMatchObject({ valid: false, reason: "revoked" });
    expect((await validateTrackedSession(rotated.sessionToken)).valid).toBe(true);

    await expect(revokeSession(rotated.sessionToken, userId)).resolves.toBe(true);
    expect(await validateTrackedSession(rotated.sessionToken)).toMatchObject({ valid: false, reason: "revoked" });
  });

  it("applies middleware redirects for signed-out and signed-in users", () => {
    expect(getMiddlewareRedirectTarget("/dashboard", false)).toBe("/login");
    expect(getMiddlewareRedirectTarget("/login", true, 3)).toBe("/dashboard");
    expect(getMiddlewareRedirectTarget("/dashboard", true, 3)).toBeNull();
  });

  it("returns 429 after the configured auth rate limit", async () => {
    const request = makeRequest();
    await expect(applyRateLimit(request, { key: `auth-integration:${userId}`, limit: 1 })).resolves.toBeNull();
    const limited = await applyRateLimit(request, { key: `auth-integration:${userId}`, limit: 1 });
    expect(limited?.status).toBe(429);
  });

  it("accepts same-origin mutations and rejects cross-origin CSRF requests", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    expect(checkCsrf(makeRequest())).toBeNull();
    const crossOrigin = new NextRequest("http://localhost:3000/api/auth/test", {
      method: "POST",
      headers: { origin: "https://attacker.invalid" },
    });
    expect(checkCsrf(crossOrigin)?.status).toBe(403);
  });

  it.todo("email signup and verification become available when an email auth provider is implemented");
});
