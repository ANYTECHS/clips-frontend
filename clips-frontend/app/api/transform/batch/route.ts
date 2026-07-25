import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/transform/batch
 *
 * Accepts a list of clip IDs plus the desired transform style and options,
 * creates one AI transform job per clip, and returns the job stubs
 * immediately so the client can start polling for progress.
 *
 * Request body:
 *   {
 *     clipIds: string[]
 *     style:   string
 *     options?: {
 *       aspectRatio?:   string    // e.g. "9:16"
 *       burnSubtitles?: boolean
 *       speed?:         number    // e.g. 1.25
 *     }
 *   }
 *
 * Response (201):
 *   { jobs: Array<{ clipId: string; jobId: string }> }
 */

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 50;

interface TransformOptions {
  aspectRatio?: string;
  burnSubtitles?: boolean;
  speed?: number;
}

interface BatchTransformRequest {
  clipIds: string[];
  style: string;
  options?: TransformOptions;
}

function validateRequest(body: unknown): {
  data?: BatchTransformRequest;
  error?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  if (!Array.isArray(obj.clipIds) || obj.clipIds.length === 0) {
    return { error: "clipIds must be a non-empty array" };
  }

  if (obj.clipIds.length > MAX_BATCH_SIZE) {
    return {
      error: `Batch size cannot exceed ${MAX_BATCH_SIZE} clips (received ${obj.clipIds.length})`,
    };
  }

  if (!obj.clipIds.every((id) => typeof id === "string" && id.trim() !== "")) {
    return { error: "Every clipId must be a non-empty string" };
  }

  if (typeof obj.style !== "string" || obj.style.trim() === "") {
    return { error: "style must be a non-empty string" };
  }

  if (obj.options !== undefined) {
    if (typeof obj.options !== "object" || Array.isArray(obj.options)) {
      return { error: "options must be an object" };
    }
    const opts = obj.options as Record<string, unknown>;
    if (opts.aspectRatio !== undefined && typeof opts.aspectRatio !== "string") {
      return { error: "options.aspectRatio must be a string" };
    }
    if (opts.burnSubtitles !== undefined && typeof opts.burnSubtitles !== "boolean") {
      return { error: "options.burnSubtitles must be a boolean" };
    }
    if (
      opts.speed !== undefined &&
      (typeof opts.speed !== "number" || opts.speed <= 0)
    ) {
      return { error: "options.speed must be a positive number" };
    }
  }

  return {
    data: {
      clipIds: (obj.clipIds as string[]).map((id) => id.trim()),
      style: (obj.style as string).trim(),
      options: obj.options as TransformOptions | undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { data, error } = validateRequest(body);
  if (error || !data) {
    return NextResponse.json({ error }, { status: 400 });
  }

  /**
   * In production this would:
   *   1. Verify auth / quota for the user
   *   2. Write job records to the database
   *   3. Enqueue each job in the AI pipeline (SQS, Pub/Sub, etc.)
   *
   * Here we generate deterministic-looking job IDs for the demo so the
   * client can start polling /api/jobs/[id] for each one.
   */
  const jobs = data.clipIds.map((clipId) => {
    const jobId = `txj_${Date.now()}_${clipId}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    return { clipId, jobId };
  });

  return NextResponse.json({ jobs }, { status: 201 });
}
