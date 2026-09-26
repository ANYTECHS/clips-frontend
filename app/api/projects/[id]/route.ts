import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { projectsStore } from "@/app/api/projects/projectsStore";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { renameProjectBodySchema } from "@/app/api/schemas/projects.schema";
import type { ApiResponse } from "@/app/api/types";

/**
 * GET /api/projects/:id — get project details.
 * PATCH — rename project.
 * DELETE — soft delete project and cascade to clips.
 */
export async function GET(
  _request: NextRequest,
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

  const clips = clipsStore.getClipsForProject(userId, projectId);

  const body: ApiResponse<{
    id: string;
    name: string;
    thumbnailUrl: string;
    videoUrl: string;
    videoObjectKey: string;
    clipCount: number;
    createdAt: string;
  }> = {
    data: {
      id: project.id,
      name: project.name,
      thumbnailUrl: project.thumbnailUrl,
      videoUrl: project.videoUrl,
      videoObjectKey: project.videoObjectKey,
      clipCount: clips.length,
      createdAt: project.createdAt,
    },
    error: null,
  };

  return NextResponse.json(body);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: projectId } = await context.params;

  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const validation = renameProjectBodySchema.safeParse(parsedBody.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 400 },
    );
  }

  const updated = projectsStore.renameProject(userId, projectId, validation.data.name);
  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: ApiResponse<{ success: boolean; project: typeof updated }> = {
    data: { success: true, project: updated },
    error: null,
  };

  return NextResponse.json(body);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: projectId } = await context.params;

  const deleted = projectsStore.softDeleteProject(userId, projectId);
  if (!deleted) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const deletedClips = clipsStore.softDeleteClipsByProject(userId, projectId);

  const body: ApiResponse<{ success: boolean; deletedClips: number }> = {
    data: { success: true, deletedClips },
    error: null,
  };

  return NextResponse.json(body);
}
