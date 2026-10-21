import { createEmailVerificationToken, validateEmailVerificationToken } from "./emailVerification";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/app/lib/prisma";
import { isEmailVerified } from "./emailVerification";

const secret = "unit-test-secret";
const now = Date.UTC(2026, 0, 1);

describe("email verification tokens", () => {
  it("creates and validates a signed token with a 24-hour expiry", () => {
    const token = createEmailVerificationToken("user-1", "person@example.com", secret, now);

    expect(validateEmailVerificationToken(token, secret, now)).toEqual({
      sub: "user-1",
      email: "person@example.com",
      exp: now + 24 * 60 * 60 * 1000,
    });
  });

  it("rejects expired, altered, and incorrectly signed tokens", () => {
    const token = createEmailVerificationToken("user-1", "person@example.com", secret, now);

    expect(validateEmailVerificationToken(token, secret, now + 24 * 60 * 60 * 1000)).toBeNull();
    expect(validateEmailVerificationToken(`${token}x`, secret, now)).toBeNull();
    expect(validateEmailVerificationToken(token, "another-secret", now)).toBeNull();
  });
});

describe("email verification gate", () => {
  const findUnique = prisma.user.findUnique as jest.Mock;

  beforeEach(() => findUnique.mockReset());

  it("allows verified users and denies unverified or missing users", async () => {
    findUnique.mockResolvedValueOnce({ emailVerified: new Date() });
    findUnique.mockResolvedValueOnce({ emailVerified: null });
    findUnique.mockResolvedValueOnce(null);

    await expect(isEmailVerified("verified-user")).resolves.toBe(true);
    await expect(isEmailVerified("unverified-user")).resolves.toBe(false);
    await expect(isEmailVerified("missing-user")).resolves.toBe(false);
  });

  it("fails closed if the user lookup fails", async () => {
    findUnique.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(isEmailVerified("user-1")).resolves.toBe(false);
  });
});