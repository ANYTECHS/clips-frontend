import { NextRequest, NextResponse } from "next/server";
import { getEarningsReport } from "@/app/lib/mockApi";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

  // userId would come from the session in production; use a placeholder here
  const userId = "api-user";

  try {
    const data = await getEarningsReport(userId, { page, pageSize });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
