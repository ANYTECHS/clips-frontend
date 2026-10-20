jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    handlers: {},
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));

import { authOptions, handlers, signIn, signOut } from "@/app/lib/auth";

describe("Auth.js configuration", () => {
  it("registers the supported OAuth and recovery providers", () => {
    expect(authOptions.providers.map((provider) => provider.id)).toEqual([
      "google",
      "apple",
      "twitter",
      "instagram",
      "tiktok",
      "recovery",
    ]);
  });

  it("uses JWT sessions and the application sign-in route", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
    expect(authOptions.pages?.signIn).toBe("/login");
    expect(authOptions.pages?.error).toBe("/login");
  });

  it("exports the NextAuth request and session helpers", () => {
    expect(handlers).toEqual({});
    expect(typeof signIn).toBe("function");
    expect(typeof signOut).toBe("function");
  });
});
