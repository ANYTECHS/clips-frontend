import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/**
 * Generates 1200×630 Open Graph images on demand.
 *
 * Uses `ImageResponse` from `next/og`, which is the same Satori renderer that
 * ships as `@vercel/og` — Next bundles it, so no extra dependency is needed.
 *
 * Query parameters (all optional):
 *   title     clip title
 *   score     virality score, 0-100
 *   thumbnail absolute URL of the clip thumbnail
 *   style     transform style label, e.g. "Bold & Dynamic"
 *   subtitle  free-text line under the title, e.g. "Minimalist → Bold"
 */

const WIDTH = 1200;
const HEIGHT = 630;

const MAX_TITLE_LENGTH = 90;

/** Virality score bands, matching the app's high/medium/low colouring. */
const SCORE_HIGH = 80;
const SCORE_MEDIUM = 50;
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** Only same-origin/HTTPS images are rendered — a URL here is user-controlled. */
function safeThumbnail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function scoreColor(score: number): string {
  if (score >= SCORE_HIGH) return "#22c55e";
  if (score >= SCORE_MEDIUM) return "#eab308";
  return "#ef4444";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawTitle = searchParams.get("title")?.trim() || "ClipCash";
  const title =
    rawTitle.length > MAX_TITLE_LENGTH
      ? `${rawTitle.slice(0, MAX_TITLE_LENGTH - 1)}…`
      : rawTitle;

  const subtitle = searchParams.get("subtitle")?.trim() || null;
  const style = searchParams.get("style")?.trim() || null;
  const thumbnail = safeThumbnail(searchParams.get("thumbnail"));

  const parsedScore = Number(searchParams.get("score"));
  const score =
    Number.isFinite(parsedScore) && parsedScore >= SCORE_MIN && parsedScore <= SCORE_MAX
      ? Math.round(parsedScore)
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #171717 60%, #1f1a05 100%)",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#facc15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ color: "#fff", fontSize: 32, fontWeight: 700 }}>ClipCash</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                color: "#fff",
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 1.15,
                display: "flex",
              }}
            >
              {title}
            </div>

            {subtitle ? (
              <div style={{ color: "#a3a3a3", fontSize: 30, marginTop: 18, display: "flex" }}>
                {subtitle}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
              {score !== null ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 20px",
                    borderRadius: 999,
                    border: `2px solid ${scoreColor(score)}`,
                    color: scoreColor(score),
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  Virality {score}/100
                </div>
              ) : null}

              {style ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 20px",
                    borderRadius: 999,
                    border: "2px solid #404040",
                    color: "#d4d4d4",
                    fontSize: 26,
                  }}
                >
                  {style}
                </div>
              ) : null}
            </div>
          </div>

          {thumbnail ? (
             
            // renders plain <img>; next/image does not work inside ImageResponse.
            <img
              src={thumbnail}
              width={280}
              height={280}
              alt=""
              style={{
                width: 280,
                height: 280,
                borderRadius: 24,
                objectFit: "cover",
                border: "2px solid #262626",
              }}
            />
          ) : null}
        </div>

        <div style={{ color: "#737373", fontSize: 26, display: "flex" }}>
          Turn 1 long video into 100+ viral clips
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
