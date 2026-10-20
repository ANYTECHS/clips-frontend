import { NextResponse } from "next/server";
import { livenessCheck } from "../healthCheck";
import { ok } from "@/app/api/types";

export async function GET(): Promise<NextResponse> {
  const result = livenessCheck();

  return NextResponse.json(ok(result), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
