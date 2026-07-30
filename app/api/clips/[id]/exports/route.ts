import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { exportsStore } from "@/app/api/exports/exportsStore";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { buildObjectUrl } from "@/app/lib/cloudStorage";
import type { ApiResponse } from "@/app/api/types";

/**
 * GET /api/clips/:id/exports
 *
 * List all export versions for a clip with status and download URLs.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;

  clipsStore.getClipsForUser(userId);
  const unowned = clipsStore.findUnownedClipIds(userId, [clipId]);
  if (unowned.length > 0) {
    return NextResponse.json({ error: "Clip not found" }, { status: 403 });
  }

  const exports = exportsStore.getExportsForClip(clipId, userId);

  const synced = await Promise.all(
    exports.map(async (exp) => {
      const job = await jobStore.get(exp.jobId);
      let status = exp.status;
      let downloadUrl = exp.downloadUrl;
      let errorMessage = exp.errorMessage;
      let completedAt = exp.completedAt;

      if (job) {
        if (job.status === "processing" && status === "queued") {
          status = "processing";
        }
        if (job.status === "complete" && status !== "complete") {
          status = "complete";
          downloadUrl = buildObjectUrl(exp.objectKey);
          completedAt = new Date().toISOString();
          exportsStore.updateByJobId(exp.jobId, { status, downloadUrl, completedAt });
        }
        if (job.status === "error") {
          status = "error";
          errorMessage = job.errorMessage ?? "Transcoding failed";
          exportsStore.updateByJobId(exp.jobId, { status, errorMessage });
        }
      }

      if (status === "complete" && !downloadUrl) {
        downloadUrl = buildObjectUrl(exp.objectKey);
      }

      return {
        id: exp.id,
        clipId: exp.clipId,
        format: exp.format,
        aspectRatio: exp.aspectRatio,
        quality: exp.quality,
        status,
        downloadUrl: status === "complete" ? downloadUrl : null,
        errorMessage: status === "error" ? errorMessage : null,
        createdAt: exp.createdAt,
        completedAt: completedAt ?? null,
      };
    }),
  );

  const body: ApiResponse<{ exports: typeof synced }> = {
    data: { exports: synced },
    error: null,
  };

  return NextResponse.json(body);
}
