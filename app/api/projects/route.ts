import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { projectsStore } from "./projectsStore";
import type { ApiResponse } from "../types";
import { parseFieldSelection, pickFields } from "@/app/lib/fieldSelection";

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
    "id", "name", "thumbnailUrl", "videoUrl", "clipCount", "createdAt",
  ] as (keyof ProjectResponse & string)[],
  defaultFields: [
    "id", "name", "thumbnailUrl", "clipCount", "createdAt",
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
    return NextResponse.json(
      { error: fieldResult.error },
      { status: 400 }
    );
  }

  const projects = projectsStore.getProjectsForUser(userId);
  clipsStore.getClipsForUser(userId);

  const allProjects: ProjectResponse[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl,
    videoUrl: p.videoUrl,
    clipCount: clipsStore.getClipsForProject(userId, p.id).length,
    createdAt: p.createdAt,
  }));

  const selectedProjects = allProjects.map((p) => pickFields(p, fieldResult.fields));

  const body: ApiResponse<{ projects: typeof selectedProjects }> = {
    data: {
      projects: selectedProjects,
    },
    error: null,
  };

  return NextResponse.json(body);
}
