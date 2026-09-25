import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { projectsStore } from "./projectsStore";
import type { ApiResponse } from "../types";
import { parseFieldSelection, pickFields } from "@/app/lib/fieldSelection";
import { paginateItems, parsePaginationParams } from "../pagination";

type ProjectResponse = {
  id: string;
  name: string;
  thumbnailUrl: string;
  videoUrl: string;
  clipCount: number;
  createdAt: string;
};

const PROJECT_FIELD_CONFIG = {
  allowedFields: [
    "id",
    "name",
    "thumbnailUrl",
    "videoUrl",
    "clipCount",
    "createdAt",
  ] as (keyof ProjectResponse & string)[],
  defaultFields: [
    "id",
    "name",
    "thumbnailUrl",
    "clipCount",
    "createdAt",
  ] as (keyof ProjectResponse & string)[],
};

/**
 * GET /api/projects — list all projects for the authenticated user.
 * Supports `?fields=id,name,clipCount` for sparse fieldsets.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const fieldResult = parseFieldSelection(searchParams.get("fields"), PROJECT_FIELD_CONFIG);
  if (!fieldResult.ok) {
    return NextResponse.json({ error: fieldResult.error }, { status: 400 });
  }

  const projects = projectsStore.getProjectsForUser(userId);
  const userClips = clipsStore.getClipsForUser(userId);

  const allProjects: ProjectResponse[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl,
    videoUrl: p.videoUrl,
    clipCount: userClips.filter((clip) => clip.projectId === p.id).length,
    createdAt: p.createdAt,
  }));

  const { items: pagedProjects, meta } = paginateItems(
    allProjects,
    parsePaginationParams(searchParams, 50)
  );
  const selectedProjects = pagedProjects.map((p) => pickFields(p, fieldResult.fields));

  const body: ApiResponse<{ projects: typeof selectedProjects; total: number }> = {
    data: {
      projects: selectedProjects,
      total: meta.total ?? allProjects.length,
    },
    error: null,
    meta,
  };

  return NextResponse.json(body);
}
