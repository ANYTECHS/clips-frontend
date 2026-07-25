import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { consumeQuota, getRemainingQuota, type Plan } from "@/app/lib/transformQuota";

/**
 * Request body shape for POST /api/transform
 */
interface TransformRequest {
  clipId: string;
  style: string;
}

/**
 * POST /api/transform
 *
 * Checks the user's monthly transform quota before dispatching the job.
 *
 * Responses:
 *   202  { jobId, quotaRemaining }          — job accepted
 *   400  { error: "..." }                   — bad request
 *   401  { error: "Unauthorized" }          — not signed in
 *   429  { code: "QUOTA_EXCEEDED", resetAt} — monthly limit hit
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use email as the stable user identifier (no DB user ID in this project).
  const userId = session.user.email;

  // Derive plan from the session. The session callback in auth.ts stores it
  // on session.user — fall back to "free" if missing.
  const plan = ((session.user as any).plan ?? "free") as Plan;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Partial<TransformRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { clipId, style } = body;

  if (!clipId || typeof clipId !== "string") {
    return NextResponse.json(
      { error: "clipId is required and must be a string" },
      { status: 400 }
    );
  }

  if (!style || typeof style !== "string") {
    return NextResponse.json(
      { error: "style is required and must be a string" },
      { status: 400 }
    );
  }

  const VALID_STYLES = [
    "anime",
    "cinematic",
    "sketch",
    "watercolor",
    "retro-vhs",
    "neon-noir",
  ];

  if (!VALID_STYLES.includes(style)) {
    return NextResponse.json(
      {
        error: `Unknown style "${style}". Valid styles: ${VALID_STYLES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // ── Quota check ───────────────────────────────────────────────────────────
  const result = consumeQuota(userId, plan);

  if (!result.allowed) {
    return NextResponse.json(
      {
        code: "QUOTA_EXCEEDED",
        error:
          "You have reached your monthly transformation limit. Upgrade your plan to continue.",
        resetAt: result.resetAt,
        upgradePath: "/settings?tab=billing",
      },
      { status: 429 }
    );
  }

  // ── Dispatch job (simulated) ───────────────────────────────────────────────
  // In production this would enqueue a background job (e.g. via a queue
  // service) and return the job ID immediately.
  const jobId = `job_${style}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;

  return NextResponse.json(
    {
      jobId,
      clipId,
      style,
      status: "queued",
      quotaRemaining: result.remaining,
    },
    { status: 202 }
  );
}

/**
 * GET /api/transform
 *
 * Returns the current quota status for the authenticated user without
 * consuming any credits — used by the StylePicker to display the counter.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.email;
  const plan = ((session.user as any).plan ?? "free") as Plan;
  const remaining = getRemainingQuota(userId, plan);

  // Import here to avoid a circular dep with transformQuota
  const { getQuota, PLAN_LIMITS } = await import("@/app/lib/transformQuota");
  const record = getQuota(userId, plan);

  return NextResponse.json({
    plan,
    quotaRemaining: remaining === Infinity ? null : remaining,
    quotaLimit: PLAN_LIMITS[plan] === Infinity ? null : PLAN_LIMITS[plan],
    resetAt: record.resetAt,
    unlimited: plan === "enterprise",
  });
}
