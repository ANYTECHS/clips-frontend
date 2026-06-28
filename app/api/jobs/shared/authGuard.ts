import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { jobStore } from "./jobStore";

export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { userId };
}

/** Validates session and job ownership. Returns job or a 401/403/404 response. */
export async function requireJobOwner(jobId: string) {
  const authRes = await requireAuth();
  if (authRes instanceof NextResponse) return authRes;

  const job = await jobStore.get(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.userId !== authRes.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { job, userId: authRes.userId };
}
