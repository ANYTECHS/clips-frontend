import { NextRequest, NextResponse } from "next/server";
import { requireJobOwner } from "@/app/api/jobs/shared/authGuard";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

/** Accepts UUID (with or without hyphens) or alphanumeric slugs up to 64 chars. */
const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

type TransformJobRecord = {
  progress: number;
  status: string;
  errorMessage?: string;
  previewUrl?: string | null;
  resultUrl?: string | null;
};

function validateJobId(id: string): NextResponse | null {
  if (!JOB_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid job id format" }, { status: 400 });
  }
  return null;
}

function toTransformStatusPayload(job: TransformJobRecord) {
  return {
    progress: job.progress,
    status: job.status,
    ...(job.previewUrl != null ? { previewUrl: job.previewUrl } : {}),
    ...(job.resultUrl != null ? { resultUrl: job.resultUrl } : {}),
    ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
  };
}

// ─── GET /api/transform/[id] ──────────────────────────────────────────────────

/**
 * Returns transform job status for the authenticated owner.
 * Used by `useTransformStatus` as the polling fallback after SSE failure.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimited = await applyRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { id: jobId } = await context.params;
  const idError = validateJobId(jobId);
  if (idError) return idError;

  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  const { job } = result;
  return NextResponse.json(toTransformStatusPayload(job as TransformJobRecord));
}

export { toTransformStatusPayload };
export type { TransformJobRecord };
