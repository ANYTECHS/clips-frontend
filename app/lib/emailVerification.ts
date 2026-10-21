import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/app/lib/prisma";

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface EmailVerificationClaims {
  sub: string;
  email: string;
  exp: number;
}

function getVerificationSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for email verification");
  return secret;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createEmailVerificationToken(
  userId: string,
  email: string,
  secret = getVerificationSecret(),
  now = Date.now(),
): string {
  const claims: EmailVerificationClaims = {
    sub: userId,
    email,
    exp: now + TOKEN_LIFETIME_MS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function validateEmailVerificationToken(
  token: string,
  secret = getVerificationSecret(),
  now = Date.now(),
): EmailVerificationClaims | null {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra !== undefined) return null;

  let receivedSignature: Buffer;
  let claims: EmailVerificationClaims;
  try {
    receivedSignature = Buffer.from(encodedSignature, "base64url");
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as EmailVerificationClaims;
  } catch {
    return null;
  }

  const expectedSignature = sign(payload, secret);
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return null;
  }

  if (
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string" ||
    typeof claims.exp !== "number" ||
    claims.exp <= now
  ) {
    return null;
  }

  return claims;
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    return user?.emailVerified instanceof Date;
  } catch {
    return false;
  }
}