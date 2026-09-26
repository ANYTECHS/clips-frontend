import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { projectsStore } from "@/app/api/projects/projectsStore";
import { clipsStore } from "@/app/api/clips/clipsStore";
import type { ApiResponse } from "@/app/api/types";
import { paginateItems, parsePaginationParams } from "@/app/api/pagination";

/**
 * GET /api/projects/:id/clips — list clips for a specific project.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: projectId } = await context.params;
  const project = projectsStore.getProjectById(userId, projectId);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const allClips = clipsStore.getClipsForProject(userId, projectId);
  const { items: clips, meta } = paginateItems(allClips, parsePaginationParams(searchParams, 50));

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
      total: meta.total,
      page: meta.page,
      pageSize: meta.pageSize,
    },
    error: null,
    meta,
  };

  return NextResponse.json(body);
}
