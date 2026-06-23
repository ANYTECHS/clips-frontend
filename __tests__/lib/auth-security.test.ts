import {
  persistClipcashUser,
  clearClipcashUser,
} from "@/app/lib/authUser";

describe("AuthProvider password security", () => {
  beforeEach(() => localStorage.clear());

  it("strips password field before persisting to localStorage", () => {
    persistClipcashUser({
      id: "123",
      email: "test@example.com",
      name: "Test User",
      onboardingStep: 1,
      profile: {},
      password: "super-secret",
    } as never);

    const stored = JSON.parse(localStorage.getItem("clipcash_user")!);
    expect(stored).not.toHaveProperty("password");
  });

  it("preserves all non-sensitive fields", () => {
    persistClipcashUser({
      id: "123",
      email: "test@example.com",
      name: "Test User",
      onboardingStep: 1,
      profile: {},
    });

    const stored = JSON.parse(localStorage.getItem("clipcash_user")!);
    expect(stored.id).toBe("123");
    expect(stored.email).toBe("test@example.com");
    expect(stored.onboardingStep).toBe(1);
  });

  it("works correctly when user has no password field", () => {
    persistClipcashUser({
      id: "456",
      email: "user@example.com",
      onboardingStep: 0,
      profile: { username: "testuser" },
    });

    const stored = JSON.parse(localStorage.getItem("clipcash_user")!);
    expect(stored).not.toHaveProperty("password");
    expect(stored.profile.username).toBe("testuser");
  });

  it("clears localStorage on logout (null user)", () => {
    persistClipcashUser({ id: "123", email: "test@example.com", onboardingStep: 0 });
    clearClipcashUser();
    expect(localStorage.getItem("clipcash_user")).toBeNull();
  });
});
