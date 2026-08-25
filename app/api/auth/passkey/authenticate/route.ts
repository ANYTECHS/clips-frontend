import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
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

/**
 * GET /api/auth/passkey/authenticate
 * Generates WebAuthn authentication options for the user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rpID } = getWebAuthnConfig(request);
    const credentials = passkeyStore.getCredentials(userId);

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: "No passkeys registered for user" },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: credentials.map((cred) => ({
        id: cred.credentialId,
        // WebAuthn transports types are incomplete - use as any
        transports: cred.transports as any,
      })),
    });

    passkeyStore.saveChallenge(userId, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    logger.error("Passkey authentication options error:", error);
    return NextResponse.json({ error: "Failed to generate authentication options" }, { status: 500 });
  }
}

/**
 * POST /api/auth/passkey/authenticate
 * Verifies WebAuthn assertion response.
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

    const parsedBody = await parseRequestJson<{ id?: string; rawId?: string }>(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const credentialId = body?.id ?? body?.rawId;

    if (!credentialId) {
      return NextResponse.json({ error: "Missing credential ID" }, { status: 400 });
    }

    const credential = passkeyStore.getCredentialById(credentialId);
    if (!credential || credential.userId !== userId) {
      return NextResponse.json(
        { error: "Credential not found or unauthorized" },
        { status: 400 }
      );
    }

    const expectedChallenge = passkeyStore.getChallenge(userId);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Authentication challenge expired or missing" },
        { status: 400 }
      );
    }

    const { rpID, expectedOrigin } = getWebAuthnConfig(request);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64url"),
        counter: credential.counter,
        // WebAuthn transports types are incomplete - use as any
        transports: credential.transports as any,
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { error: "Passkey authentication verification failed" },
        { status: 400 }
      );
    }

    passkeyStore.updateCounter(
      credential.credentialId,
      verification.authenticationInfo.newCounter
    );
    passkeyStore.clearChallenge(userId);

    return NextResponse.json({
      verified: true,
      credentialId: credential.credentialId,
      publicKey: credential.stellarPublicKey,
    });
  } catch (error) {
    logger.error("Passkey authentication verification error:", error);
    return NextResponse.json({ error: "Internal server error during authentication" }, { status: 500 });
  }
}
