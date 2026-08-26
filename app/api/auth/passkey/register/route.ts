import { NextRequest, NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { auth } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { passkeyStore } from "../passkeyStore";

function getWebAuthnConfig(request: NextRequest) {
  const url = new URL(request.url);
  const rpID = process.env.WEBAUTHN_RP_ID || url.hostname;
  const expectedOrigin =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") || `${url.protocol}//${url.host}`;
  return { rpID, expectedOrigin };
}

function deriveStellarPublicKey(credId: string): string {
  const hash = Array.from(credId)
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
    .toString(16)
    .toUpperCase()
    .padStart(8, "0");
  return `GPASSKEY${hash}${"A".repeat(48)}`.slice(0, 56);
}

/**
 * GET /api/auth/passkey/register
 * Generates WebAuthn registration options for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const userEmail = (session?.user as { email?: string } | undefined)?.email ?? "user@clipcash.ai";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rpID } = getWebAuthnConfig(request);
    const existingCreds = passkeyStore.getCredentials(userId);

    const options = await generateRegistrationOptions({
      rpName: "ClipCash",
      rpID,
      userID: Buffer.from(userId, "utf-8"),
      userName: userEmail,
      userDisplayName: userEmail.split("@")[0] || "User",
      attestationType: "none",
      excludeCredentials: existingCreds.map((cred) => ({
        id: cred.credentialId,
        // WebAuthn transports types are incomplete - use as any
        transports: cred.transports as any,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    passkeyStore.saveChallenge(userId, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    logger.error("Passkey registration options error:", error);
    return NextResponse.json({ error: "Failed to generate registration options" }, { status: 500 });
  }
}

/**
 * POST /api/auth/passkey/register
 * Verifies WebAuthn registration response and stores credential linked to user.
 */
export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expectedChallenge = passkeyStore.getChallenge(userId);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Registration challenge expired or missing. Please try again." },
        { status: 400 }
      );
    }

    const parsedBody = await parseRequestJson(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const { rpID, expectedOrigin } = getWebAuthnConfig(request);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const credentialIdStr =
      typeof credentialID === "string"
        ? credentialID
        : Buffer.from(credentialID).toString("base64url");
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString("base64url");
    const stellarPublicKey = deriveStellarPublicKey(credentialIdStr);

    passkeyStore.addCredential(userId, {
      credentialId: credentialIdStr,
      publicKey: publicKeyBase64,
      userId,
      counter,
      transports: body.response?.transports,
      createdAt: new Date().toISOString(),
      stellarPublicKey,
    });

    passkeyStore.clearChallenge(userId);

    return NextResponse.json({
      verified: true,
      credentialId: credentialIdStr,
      publicKey: stellarPublicKey,
    });
  } catch (error) {
    logger.error("Passkey registration verification error:", error);
    return NextResponse.json({ error: "Internal server error during registration" }, { status: 500 });
  }
}
