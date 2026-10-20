import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";
import { UserPreferencesStorage } from "@/app/lib/userPreferences";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { logger } from "@/app/lib/logger";

interface DeleteAccountBody {
  confirmation?: string;
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const userId = await getAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;

  const body = (parsed.body || {}) as DeleteAccountBody;
  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation text must be 'DELETE'" },
      { status: 400 }
    );
  }

  try {
    // 1. Cancel / delete any active jobs in jobStore
    try {
      const jobs = await jobStore.getUserJobs(userId);
      for (const job of jobs) {
        await jobStore.delete(job.id);
      }
    } catch (jobErr) {
      logger.warn("[delete-account] Failed to clean up user jobs:", jobErr);
    }

    // 2. Remove in-memory user preferences if present
    UserPreferencesStorage.delete(userId);

    // 3. Delete database records (cascading deletes sessions, notifications, api keys, webhooks)
    try {
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (dbErr) {
      // If user doesn't exist in Prisma (e.g. mock session), log and continue
      logger.warn("[delete-account] Prisma user deletion skipped or failed:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    logger.error("[delete-account] Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  return POST(request);
}
