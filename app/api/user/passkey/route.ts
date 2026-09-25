import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { passkeyStore } from "@/app/api/auth/passkey/passkeyStore";
import { paginateItems, parsePaginationParams } from "@/app/api/pagination";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentials = passkeyStore.getCredentials(userId);
    const { searchParams } = new URL(request.url);
    const { items, meta } = paginateItems(credentials, parsePaginationParams(searchParams, 50));

    return NextResponse.json({
      hasPasskey: credentials.length > 0,
      credentials: items,
      total: meta.total,
      meta,
    });
  } catch (error) {
    logger.error("Error fetching passkey status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseRequestJson<{ credentialId?: string; publicKey?: string }>(
      request
    );
    if (!parsedBody.ok) return parsedBody.response;
    const { credentialId, publicKey } = parsedBody.body;

    if (!credentialId) {
      return NextResponse.json({ error: "Missing credentialId" }, { status: 400 });
    }

    logger.info(`Persisting passkey for user ${userId}: ${credentialId}`);

    passkeyStore.addCredential(userId, {
      credentialId,
      publicKey: publicKey ?? credentialId,
      userId,
      counter: 0,
      createdAt: new Date().toISOString(),
      stellarPublicKey: publicKey,
    });

    return NextResponse.json({ success: true, message: "Passkey registered successfully" });
  } catch (error) {
    logger.error("Passkey persistence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
