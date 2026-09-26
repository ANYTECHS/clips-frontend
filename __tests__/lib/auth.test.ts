import { jwtCallback, sessionCallback } from "@/app/lib/authCallbacks";
import { DEFAULT_ONBOARDING_STEP } from "@/__mocks__/app/lib/mockApi";
import * as userApi from "@/app/lib/userApi";

jest.mock("@/app/lib/userApi");
const mockFetchOnboardingStep = userApi.fetchOnboardingStep as jest.MockedFunction<
  typeof userApi.fetchOnboardingStep
>;

beforeEach(() => {
  jest.resetAllMocks();
});

// ─── jwtCallback ─────────────────────────────────────────────────────────────

describe("jwtCallback", () => {
  it("fetches onboardingStep from the backend on initial sign-in and stores it in the token", async () => {
    mockFetchOnboardingStep.mockResolvedValue(3);

    const token = await jwtCallback({
      token: { email: "test@example.com" },
      user: { email: "test@example.com", id: "test-user-id" },
      account: { provider: "google", type: "oauth", providerAccountId: "123", access_token: "tok" },
    });

    expect(mockFetchOnboardingStep).toHaveBeenCalledWith("test@example.com", "tok");
    expect(token.onboardingStep).toBe(3);
  });

  it("passes the access token from the account to the backend fetch", async () => {
    mockFetchOnboardingStep.mockResolvedValue(2);

    await jwtCallback({
      token: { email: "user@example.com" },
      user: { email: "user@example.com", id: "u1" },
      account: {
        provider: "google",
        type: "oauth",
        providerAccountId: "456",
        access_token: "my-access-token",
      },
    });

    expect(mockFetchOnboardingStep).toHaveBeenCalledWith("user@example.com", "my-access-token");
  });

  it("uses email from the token when user is not present (token refresh)", async () => {
    // On token refresh account is null — fetchOnboardingStep should NOT be called.
    const token = await jwtCallback({
      token: { email: "returning@example.com", onboardingStep: 5 },
      account: null,
    });

    expect(mockFetchOnboardingStep).not.toHaveBeenCalled();
    // onboardingStep already in the token is preserved as-is
    expect(token.onboardingStep).toBe(5);
  });

  it("does not call the backend on token refresh (account is null)", async () => {
    await jwtCallback({
      token: { onboardingStep: 2 },
      account: null,
    });

    expect(mockFetchOnboardingStep).not.toHaveBeenCalled();
  });

  it("stores provider and profile in the token on sign-in", async () => {
    mockFetchOnboardingStep.mockResolvedValue(1);

    const profile = { sub: "g-123", email: "u@example.com" };
    const token = await jwtCallback({
      token: {},
      user: { email: "u@example.com", id: "u2" },
      account: {
        provider: "google",
        type: "oauth",
        providerAccountId: "g-123",
        access_token: "tok2",
      },
      profile,
    });

    expect(token.provider).toBe("google");
    expect(token.profile).toEqual(profile);
  });
});

// ─── sessionCallback ──────────────────────────────────────────────────────────

describe("sessionCallback", () => {
  it("reads onboardingStep from the JWT and writes it to the session user", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "test@example.com", name: "Test User" },
        expires: "2099-01-01",
      },
      token: { onboardingStep: 3 },
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(3);
    // sessionCallback must never call the backend
    expect(mockFetchOnboardingStep).not.toHaveBeenCalled();
  });

  it("falls back to DEFAULT_ONBOARDING_STEP when the token has no onboardingStep", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "test@example.com", name: "Test User" },
        expires: "2099-01-01",
      },
      token: {},
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(
      DEFAULT_ONBOARDING_STEP
    );
    expect(mockFetchOnboardingStep).not.toHaveBeenCalled();
  });

  it("falls back to DEFAULT_ONBOARDING_STEP for unknown users with no token value", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "unknown@example.com", name: "Unknown" },
        expires: "2099-01-01",
      },
      token: {},
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(
      DEFAULT_ONBOARDING_STEP
    );
  });

  it("does not derive onboarding step from the email address", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "brandnew@example.com", name: "New User" },
        expires: "2099-01-01",
      },
      token: { onboardingStep: DEFAULT_ONBOARDING_STEP },
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(
      DEFAULT_ONBOARDING_STEP
    );
  });

  it("copies accessToken, provider, and profile from the JWT to the session", async () => {
    const profile = { sub: "g-123", email: "u@example.com" };
    const result = await sessionCallback({
      session: {
        user: { email: "u@example.com", name: "U" },
        expires: "2099-01-01",
      },
      token: {
        sub: "sub-abc",
        accessToken: "at-xyz",
        provider: "google",
        profile,
        onboardingStep: 1,
      },
    });

    const u = result.user as {
      id?: string;
      accessToken?: string;
      provider?: string;
      profile?: unknown;
    };
    expect(u.id).toBe("sub-abc");
    expect(u.accessToken).toBe("at-xyz");
    expect(u.provider).toBe("google");
    expect(u.profile).toEqual(profile);
  });
});
