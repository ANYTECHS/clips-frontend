import { NextRequest, NextResponse } from "next/server";

/* ---------- types ---------- */

type InsightType = "top_performer" | "best_posting_time" | "trending_style" | "low_performer";

export interface Insight {
  id: string;
  text: string;
  type: InsightType;
  metric: string;
  clipId?: string;
  createdAt: string;
}

/* ---------- cache (1 hour per user) ---------- */

const cache = new Map<string, { data: Insight[]; expiresAt: number }>();

/* ---------- mock data generation ---------- */

function generateMockInsights(): Insight[] {
  return [
    {
      id: "insight-001",
      text: 'Your clip "Epic Gaming Montage" has the highest view count this week — consider posting similar content.',
      type: "top_performer",
      metric: "12,340 views",
      clipId: "CLIP-001",
      createdAt: new Date().toISOString(),
    },
    {
      id: "insight-002",
      text: "Your audience is most active between 6-9 PM EST. Schedule posts during this window for maximum reach.",
      type: "best_posting_time",
      metric: "6-9 PM EST",
      createdAt: new Date().toISOString(),
    },
    {
      id: "insight-003",
      text: "AI-transformed clips with 'Anime' style are trending 40% higher than other styles this month.",
      type: "trending_style",
      metric: "Anime +40%",
      createdAt: new Date().toISOString(),
    },
    {
      id: "insight-004",
      text: '"Product Review" clips have lower-than-average engagement. Consider trimming to under 30 seconds.',
      type: "low_performer",
      metric: "1.2% engagement",
      clipId: "CLIP-042",
      createdAt: new Date().toISOString(),
    },
  ];
}

/* ---------- route ---------- */

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "anonymous";
  const now = Date.now();

  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  const insights = generateMockInsights();
  cache.set(userId, { data: insights, expiresAt: now + 60 * 60 * 1000 });

  return NextResponse.json(insights);
}