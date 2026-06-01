import { jwtCallback, sessionCallback } from "@/app/lib/authCallbacks";
import { DEFAULT_ONBOARDING_STEP } from "@/app/lib/mockApi";

describe("session callback", () => {
  it("uses onboardingStep from the token", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "test@example.com", name: "Test User" },
        expires: "2099-01-01",
      },
      token: { onboardingStep: 3 },
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(3);
  });

  it("loads onboardingStep from the user profile when missing on token", async () => {
    const result = await sessionCallback({
      session: {
        user: { email: "test@example.com", name: "Test User" },
        expires: "2099-01-01",
      },
      token: {},
    });

    expect((result.user as { onboardingStep: number }).onboardingStep).toBe(3);
  });

  it("uses the default onboarding step for unknown users", async () => {
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

  it("does not derive onboarding from email substrings", async () => {
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
});

describe("jwt callback", () => {
  it("stores onboardingStep from the user profile", async () => {
    const token = await jwtCallback({
      token: { email: "test@example.com" },
      user: { email: "test@example.com", id: "test-user-id" },
      account: null,
    });

    expect(token.onboardingStep).toBe(3);
  });
});
