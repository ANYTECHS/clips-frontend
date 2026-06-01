import { getAuthRedirectTarget } from "@/app/lib/authRedirect";
import type { User } from "@/app/lib/mockApi";

const baseUser: User = {
  id: "1",
  email: "user@example.com",
  onboardingStep: 3,
};

describe("getAuthRedirectTarget", () => {
  it("returns null while auth is loading", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/dashboard",
        user: baseUser,
        isAuthReady: false,
      })
    ).toBeNull();
  });

  it("redirects unauthenticated users away from protected routes", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/dashboard",
        user: null,
        isAuthReady: true,
      })
    ).toBe("/login");
  });

  it("redirects authenticated users on auth routes to the dashboard", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/login",
        user: baseUser,
        isAuthReady: true,
      })
    ).toBe("/dashboard");
  });

  it("redirects incomplete onboarding users to onboarding", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/login",
        user: { ...baseUser, onboardingStep: 1 },
        isAuthReady: true,
      })
    ).toBe("/onboarding");
  });

  it("redirects completed users away from onboarding", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/onboarding",
        user: baseUser,
        isAuthReady: true,
      })
    ).toBe("/dashboard");
  });

  it("does not redirect when already on the target route", () => {
    expect(
      getAuthRedirectTarget({
        pathname: "/dashboard",
        user: baseUser,
        isAuthReady: true,
      })
    ).toBeNull();
  });
});
