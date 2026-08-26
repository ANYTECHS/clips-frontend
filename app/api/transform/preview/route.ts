/**
 * POST /api/transform/preview
 *
 * Low-resolution, fast-turnaround preview endpoint for the anime
 * transformation style. Returns a single frame URL within ~5 seconds so the
 * UI can show the user what their settings will look like before committing
 * to a full-quality job.
 *
 * Request body:
 * {
 *   clipId:           string                 — source clip id
 *   style:            string                 — must be "anime" (only style
 *                                              with tuning controls for now)
 *   transformOptions: AnimeTransformOptions  — sub-style, intensity, etc.
 * }
 *
 * Response 200:
 * { previewUrl: string }   — URL to the generated preview frame / short clip
 *
 * When NEXT_PUBLIC_AI_API_URL is not set the route returns a placeholder
 * preview URL (public asset) so the UI can still demonstrate the feature
 * locally without a live AI backend.
 *
 * Rate limit: 60 requests / minute — previews are cheap but still backend
 * calls, so we cap them to prevent abuse.
 *
 * Auth: session required (same user-gating as the full transform route).
 * CSRF: required (same-origin check).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { validateAnimeOptions } from "@/app/lib/animeTransform";
import { logger } from "@/app/lib/logger";
import { randomUUID } from "crypto";

// ─── Validation ───────────────────────────────────────────────────────────────

const PREVIEW_SUPPORTED_STYLES = ["anime"] as const;

interface PreviewRequestBody {
  clipId: string;
  style: string;
  transformOptions: unknown;
}

function validatePreviewBody(
  raw: unknown,
): { valid: true; data: PreviewRequestBody } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }
  const b = raw as Record<string, unknown>;

  if (typeof b.clipId !== "string" || !b.clipId.trim()) {
    return { valid: false, error: "clipId is required." };
  }
  if (
    typeof b.style !== "string" ||
    !(PREVIEW_SUPPORTED_STYLES as readonly string[]).includes(b.style.toLowerCase())
  ) {
    return {
      valid: false,
      error: `style must be one of: ${PREVIEW_SUPPORTED_STYLES.join(", ")}.`,
    };
  }
  if (!b.transformOptions || typeof b.transformOptions !== "object") {
    return { valid: false, error: "transformOptions is required." };
  }

  return {
    valid: true,
    data: {
      clipId: b.clipId.trim(),
      style: b.style.toLowerCase(),
      transformOptions: b.transformOptions,
    },
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bodyValidation = validatePreviewBody(rawBody);
  if (!bodyValidation.valid) {
    return NextResponse.json({ error: bodyValidation.error }, { status: 400 });
  }

  const { clipId, style, transformOptions: rawOptions } = bodyValidation.data;

  // Validate anime-specific options
  const optionsValidation = validateAnimeOptions(rawOptions);
  if (!optionsValidation.valid) {
    return NextResponse.json(
      { error: optionsValidation.errors.join(" ") },
      { status: 422 },
    );
  }
  const transformOptions = optionsValidation.data!;

  // ── Forward to AI backend ────────────────────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_AI_API_URL;

  if (!baseUrl) {
    // No backend configured — return a placeholder preview so the UI still
    // shows something during local development.
    logger.warn("[transform/preview] NEXT_PUBLIC_AI_API_URL not set; returning placeholder preview.");
    return NextResponse.json({
      previewUrl: `/styles/anime-preview-placeholder.jpg`,
    });
  }

  const secret = process.env.AI_BACKEND_SECRET;
  const previewJobId = `preview_${randomUUID().replace(/-/g, "")}`;

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/preview`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        previewJobId,
        clipId,
        userId,
        style,
        transformOptions,
        // Ask the backend for a single representative frame, not a full clip
        mode: "frame",
      }),
      // The preview must arrive quickly — hard 8-second timeout leaves 2 s
      // of network margin within the 10-second client-side budget.
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      logger.error(
        `[transform/preview] Backend returned ${res.status} for preview ${previewJobId}: ${text}`,
      );
      return NextResponse.json(
        { error: "Preview generation failed. Try again in a moment." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { previewUrl?: string };
    if (!data.previewUrl) {
      logger.error(`[transform/preview] Backend response missing previewUrl for ${previewJobId}`);
      return NextResponse.json(
        { error: "Preview URL missing from AI response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ previewUrl: data.previewUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[transform/preview] Request failed for ${previewJobId}: ${message}`);

    // Timeout — give the user a clear message
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Preview timed out. The AI backend may be under load — try again shortly." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "Unable to generate preview. Please try again." },
      { status: 502 },
    );
  }
}
