import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { projectsStore } from "@/app/api/projects/projectsStore";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { NextResponse } from "next/server";

export async function getProjectDetail(projectId: string) {
  // Simulate slow fetch to demonstrate streaming SSR
  await new Promise(r => setTimeout(r, 2000));

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    throw new Error("Unauthorized");
  }
  const { userId } = authResult;

  const project = projectsStore.getProjectById(userId, projectId);
  if (!project) throw new Error("Project not found");

  const clips = clipsStore.getClipsForProject(userId, projectId);

  return {
    project: {
      id: project.id,
      name: project.name,
      thumbnailUrl: project.thumbnailUrl,
      videoUrl: project.videoUrl,
      clipCount: clips.length,
    },
    clips,
  };
}
