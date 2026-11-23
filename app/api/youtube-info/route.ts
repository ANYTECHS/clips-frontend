import { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/apiResponse";
import { resolveRequestId } from "@/lib/requestId";
import { Innertube } from "youtubei.js";

export const dynamic = "force-dynamic";

// Cache the Innertube instance across warm invocations to avoid re-initialising
// on every request (each init does a network round-trip to YouTube).
let _yt: Innertube | null = null;
async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({
      // Provide Node's vm module as the JS evaluator so youtubei.js can
      // decipher YouTube's obfuscated signature URLs at runtime.
      // Without this, format.decipher() throws "must provide your own
      // JavaScript evaluator".
      retrieve_player: true,
      generate_session_locally: true,
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input as RequestInfo, init),
    });
  }
  return _yt;
}

/**
 * GET /api/youtube-info?videoId=<11-char-id>
 *
 * Server-side YouTube metadata + download URL resolution using youtubei.js
 * (InnerTube) with Node vm-based URL deciphering.
 *
 * Response:
 *   { videoId, title, durationSeconds, thumbnail, downloadUrl, fileSizeBytes, quality }
 */
export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers);
  const videoId = req.nextUrl.searchParams.get("videoId") ?? "";

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return apiError(400, "Missing or invalid videoId parameter.", {
      code: "INVALID_VIDEO_ID",
      requestId,
    });
  }

  try {
    const yt   = await getYT();
    const info = await yt.getInfo(videoId);

    // Check availability
    const playStatus = info.playability_status?.status ?? "";
    if (playStatus === "LOGIN_REQUIRED" || playStatus === "AGE_CHECK_REQUIRED") {
      return apiError(403, "This video is private or age-restricted.", {
        code: "VIDEO_RESTRICTED",
        requestId,
      });
    }
    if (playStatus === "UNPLAYABLE" || playStatus === "ERROR") {
      return apiError(404, "Video is unavailable or unplayable.", {
        code: "VIDEO_UNAVAILABLE",
        requestId,
      });
    }

    // Pick best muxed (video+audio) MP4 format — prefer 720p
    let format: any;
    try {
      format = info.chooseFormat({ type: "video+audio", quality: "720p" });
    } catch {
      try {
        format = info.chooseFormat({ type: "video+audio" });
      } catch {
        format = null;
      }
    }

    if (!format) {
      return apiError(404, "No downloadable format found for this video.", {
        code: "NO_DOWNLOADABLE_FORMAT",
        requestId,
      });
    }

    // Decipher the signed URL using Node's vm module as the evaluator
    let downloadUrl: string;
    try {
      downloadUrl = format.decipher(yt.session.player);
    } catch (decipherErr: any) {
      // If decipher fails, try the raw url field (some formats have it pre-deciphered)
      if (format.url) {
        downloadUrl = format.url;
      } else {
        console.error("[youtube-info] decipher failed:", decipherErr?.message);
        return apiError(
          500,
          "Could not resolve a download URL for this video. Please upload the file directly.",
          { code: "DECIPHER_FAILED", requestId, cause: decipherErr }
        );
      }
    }

    const details         = info.basic_info;
    const title           = details.title    ?? `YouTube video ${videoId}`;
    const durationSeconds = details.duration ?? 0;
    const thumbnail       =
      details.thumbnail?.[0]?.url ??
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    const fileSizeBytes: number | null =
      format.content_length != null ? Number(format.content_length) : null;
    const quality: string = format.quality_label ?? "unknown";

    return apiJson(
      {
        videoId,
        title,
        durationSeconds,
        thumbnail,
        downloadUrl,
        fileSizeBytes,
        quality,
      },
      { requestId }
    );
  } catch (err: any) {
    const msg: string = err?.message ?? "Unknown error";
    console.error("[youtube-info] error:", msg);

    if (
      msg.toLowerCase().includes("private") ||
      msg.toLowerCase().includes("sign in")
    ) {
      return apiError(403, "This video is private or requires sign-in.", {
        code: "VIDEO_RESTRICTED",
        requestId,
      });
    }
    if (
      msg.toLowerCase().includes("not found") ||
      msg.toLowerCase().includes("unavailable") ||
      msg.toLowerCase().includes("does not exist")
    ) {
      return apiError(404, "Video not found or unavailable.", {
        code: "VIDEO_UNAVAILABLE",
        requestId,
      });
    }

    return apiError(
      500,
      "Could not resolve video info. Please try again or upload the file directly.",
      { code: "VIDEO_INFO_FAILED", requestId, cause: err }
    );
  }
}
