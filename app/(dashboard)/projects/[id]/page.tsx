import React, { Suspense } from "react";
import { getProjectDetail } from "@/app/lib/projectService";
import ProjectDetailClient from "./ProjectDetailClient";
import ProjectDetailLoading from "./loading";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { project, clips } = await getProjectDetail(params.id);

  return (
    <Suspense fallback={<ProjectDetailLoading />}>
      <ProjectDetailClient initialProject={project} initialClips={clips} />
    </Suspense>
  );
}
