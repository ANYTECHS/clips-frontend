import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { jobStore } from "./jobStore";

/** Returns the session userId or a 401 response. */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { userId };
}

/** Validates session and job ownership. Returns job or a 401/403/404 response. */
export async function requireJobOwner(jobId: string) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const job = jobStore.get(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.userId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { job, userId: auth.userId };
}
