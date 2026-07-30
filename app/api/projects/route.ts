import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { projectsStore } from "./projectsStore";
import type { ApiResponse } from "../types";

/**
 * GET /api/projects — list all projects for the authenticated user.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const projects = projectsStore.getProjectsForUser(userId);
  clipsStore.getClipsForUser(userId);

  const body: ApiResponse<{
    projects: Array<{
      id: string;
      name: string;
      thumbnailUrl: string;
      videoUrl: string;
      clipCount: number;
      createdAt: string;
    }>;
  }> = {
    data: {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        thumbnailUrl: p.thumbnailUrl,
        videoUrl: p.videoUrl,
        clipCount: clipsStore.getClipsForProject(userId, p.id).length,
        createdAt: p.createdAt,
      })),
    },
    error: null,
  };

  return NextResponse.json(body);
}
