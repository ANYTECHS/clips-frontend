import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    cohorts: [
      { cohort: "Jan 2026", users: 184, retention: [78, 61, 43, 31] },
      { cohort: "Feb 2026", users: 239, retention: [81, 66, 49, 35] },
    ],
    funnel: [
      { name: "Uploaded video", users: 1200, conversion: 100 },
      { name: "Generated clips", users: 987, conversion: 82 },
      { name: "Published clip", users: 643, conversion: 54 },
      { name: "Earned revenue", users: 284, conversion: 24 },
    ],
    attribution: [
      { source: "Organic", revenue: 4820, conversions: 184 },
      { source: "Referral", revenue: 2190, conversions: 92 },
      { source: "Social", revenue: 1640, conversions: 68 },
    ],
  });
}
