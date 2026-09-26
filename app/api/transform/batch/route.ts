import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";
import { randomUUID } from "crypto";
import {
  validateAnimeOptions,
  DEFAULT_ANIME_OPTIONS,
  type AnimeTransformOptions,
} from "@/app/lib/animeTransform";

// ─── Validation ───────────────────────────────────────────────────────────────

/** Allowed transform styles sourced from env at startup, with a safe fallback. */
const ALLOWED_STYLES: string[] = (() => {
  const raw =
    process.env.NEXT_PUBLIC_TRANSFORM_STYLES ??
    "anime,cinematic,sketch,watercolor,retro-vhs,neon-noir";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
})();

/** Maximum number of clips allowed in a single batch request. */
const MAX_BATCH_SIZE = 50;

export interface TransformOptions {
  /** Optional quality preset: "draft" | "standard" | "high" */
  quality?: "draft" | "standard" | "high";
  /** Optional target resolution, e.g. "1080x1920" */
  resolution?: string;
  /** Whether to preserve the original audio track */
  preserveAudio?: boolean;
  /**
   * Anime-specific tuning options. Only used when style === "anime".
   * Falls back to DEFAULT_ANIME_OPTIONS when omitted.
   */
  animeOptions?: AnimeTransformOptions;
}

interface BatchTransformRequestBody {
  clipIds: string[];
  style: string;
  options?: TransformOptions;
}

function validateBody(
  body: unknown,
): { valid: true; data: BatchTransformRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  // Validate clipIds
  if (!Array.isArray(b.clipIds)) {
    return { valid: false, error: "clipIds must be an array." };
  }
  if (b.clipIds.length === 0) {
    return { valid: false, error: "clipIds must contain at least one clip." };
  }
  if (b.clipIds.length > MAX_BATCH_SIZE) {
    return {
      valid: false,
      error: `Batch size exceeds the maximum of ${MAX_BATCH_SIZE} clips.`,
    };
  }
  if (!b.clipIds.every((id) => typeof id === "string" && id.trim() !== "")) {
    return { valid: false, error: "Each clipId must be a non-empty string." };
  }

  // Validate style
  if (
    typeof b.style !== "string" ||
    !ALLOWED_STYLES.includes(b.style.toLowerCase())
  ) {
    return {
      valid: false,
      error: `style must be one of: ${ALLOWED_STYLES.join(", ")}.`,
    };
  }

  // Validate optional options
  let options: TransformOptions | undefined;
  if (b.options !== undefined) {
    if (typeof b.options !== "object" || b.options === null) {
      return { valid: false, error: "options must be an object." };
    }
    const o = b.options as Record<string, unknown>;
    if (
      o.quality !== undefined &&
      !["draft", "standard", "high"].includes(o.quality as string)
    ) {
      return {
        valid: false,
        error: 'options.quality must be "draft", "standard", or "high".',
      };
    }
    options = {
      ...(o.quality !== undefined ? { quality: o.quality as TransformOptions["quality"] } : {}),
      ...(typeof o.resolution === "string" ? { resolution: o.resolution } : {}),
      ...(typeof o.preserveAudio === "boolean" ? { preserveAudio: o.preserveAudio } : {}),
    };

    // Validate anime-specific options when style is "anime"
    if (b.style === "anime" && o.animeOptions !== undefined) {
      const animeResult = validateAnimeOptions(o.animeOptions);
      if (!animeResult.valid) {
        return { valid: false, error: animeResult.errors.join(" ") };
      }
      options.animeOptions = animeResult.data;
    }
  }

  // Default anime options when style is anime and none were provided
  if (b.style === "anime" && !options?.animeOptions) {
    options = { ...options, animeOptions: DEFAULT_ANIME_OPTIONS };
  }

  return {
    valid: true,
    data: {
      clipIds: (b.clipIds as string[]).map((id) => id.trim()),
      style: b.style.toLowerCase(),
      options,
    },
  };
}

// ─── POST /api/transform/batch ─────────────────────────────────────────────────

/**
 * Batch-create AI video transformation jobs — one job per clip.
 *
 * Request body:
 *   { clipIds: string[], style: string, options?: TransformOptions }
 *
 * Response:
 *   201 { jobs: Array<{ clipId: string, jobId: string, status: "queued", dispatched: boolean }> }
 *
 * Rate limit: 20 requests/min (shared with the single-clip route — each batch
 * request counts as one, but quota is deducted per clip on the backend).
 *
 * Security: requires auth + CSRF token, identical to the single-clip route.
 */
export async function POST(request: NextRequest) {
  // Rate-limit to 20 batch-transform requests per minute per client
  const rateLimited = await applyRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Parse body
  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const rawBody = parsedBody.body;

  const validation = validateBody(rawBody);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { clipIds, style, options } = validation.data;

  // Derive callback base URL (same approach as the single-clip route)
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  // Dispatch one job per clip in parallel
  const jobPromises = clipIds.map(async (clipId) => {
    const jobId = `transform_${randomUUID().replace(/-/g, "")}`;
    const sourceClipKey = `uploads/${clipId}`;
    const callbackUrl = `${base}/api/jobs/${jobId}/callback`;

    const dispatchResult = await dispatchJob({
      jobId,
      userId,
      objectKey: sourceClipKey,
      contentType: "video/mp4",
      filename: `${clipId}.mp4`,
      callbackUrl,
      transformStyle: style,
      sourceClipKey,
      // Pass through any extra options the AI backend may understand
      ...(options ? { transformOptions: options.animeOptions ?? options } : {}),
    });

    if (!dispatchResult.dispatched) {
      logger.warn(
        `[transform/batch] Dispatch failed for clip ${clipId} job ${jobId}: ${dispatchResult.reason}. ` +
          "Job will remain in queued status.",
      );
    }

    return {
      clipId,
      jobId,
      status: "queued" as const,
      dispatched: dispatchResult.dispatched,
    };
  });

  const jobs = await Promise.all(jobPromises);

  logger.info(
    `[transform/batch] Created ${jobs.length} transform jobs for user ${userId}, style: ${style}`,
  );

  return NextResponse.json({ jobs }, { status: 201 });
}
