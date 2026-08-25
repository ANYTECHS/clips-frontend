import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { projectsStore } from "@/app/api/projects/projectsStore";
import { clipsStore } from "@/app/api/clips/clipsStore";
import type { ApiResponse } from "@/app/api/types";

/**
 * GET /api/projects/:id/clips — list clips for a specific project.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: projectId } = await context.params;
  const project = projectsStore.getProjectById(userId, projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  const allClips = clipsStore.getClipsForProject(userId, projectId);
  const total = allClips.length;
  const start = (page - 1) * pageSize;
  const clips = allClips.slice(start, start + pageSize);

  const body: ApiResponse<{
    project: { id: string; name: string; thumbnailUrl: string };
    clips: typeof clips;
    total: number;
    page: number;
    pageSize: number;
  }> = {
    data: {
      project: {
        id: project.id,
        name: project.name,
        thumbnailUrl: project.thumbnailUrl,
      },
      clips,
      total,
      page,
      pageSize,
    },
    error: null,
  };

  return NextResponse.json(body);
}
