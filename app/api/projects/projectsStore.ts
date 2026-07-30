export interface Project {
  id: string;
  userId: string;
  name: string;
  thumbnailUrl: string;
  videoUrl: string;
  videoObjectKey: string;
  createdAt: string;
  deletedAt?: string | null;
}

class ProjectsStore {
  private projects: Project[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    this.projects = [
      {
        id: "proj-1",
        userId: "default",
        name: "Product Launch Keynote",
        thumbnailUrl: "/projects/thumb1.png",
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        videoObjectKey: "uploads/proj-1/source.mp4",
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: "proj-2",
        userId: "default",
        name: "Podcast Episode #42",
        thumbnailUrl: "/projects/thumb2.png",
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        videoObjectKey: "uploads/proj-2/source.mp4",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "proj-3",
        userId: "default",
        name: "Tutorial Series Intro",
        thumbnailUrl: "/projects/thumb3.png",
        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        videoObjectKey: "uploads/proj-3/source.mp4",
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private ensureUserProjects(userId: string): void {
    const existing = this.projects.filter((p) => p.userId === userId && !p.deletedAt);
    if (existing.length === 0) {
      const seeded = this.projects
        .filter((p) => p.userId === "default")
        .map((p, idx) => ({
          ...p,
          id: `${userId}-proj-${idx + 1}`,
          userId,
        }));
      this.projects.push(...seeded);
    }
  }

  getProjectsForUser(userId: string): Project[] {
    this.ensureUserProjects(userId);
    return this.projects
      .filter((p) => p.userId === userId && !p.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getProjectById(userId: string, projectId: string): Project | undefined {
    this.ensureUserProjects(userId);
    return this.projects.find(
      (p) => p.id === projectId && p.userId === userId && !p.deletedAt,
    );
  }

  renameProject(userId: string, projectId: string, name: string): Project | undefined {
    const index = this.projects.findIndex(
      (p) => p.id === projectId && p.userId === userId && !p.deletedAt,
    );
    if (index === -1) return undefined;
    this.projects[index] = { ...this.projects[index], name };
    return this.projects[index];
  }

  softDeleteProject(userId: string, projectId: string): boolean {
    const index = this.projects.findIndex(
      (p) => p.id === projectId && p.userId === userId && !p.deletedAt,
    );
    if (index === -1) return false;
    this.projects[index] = {
      ...this.projects[index],
      deletedAt: new Date().toISOString(),
    };
    return true;
  }
}

export const projectsStore = new ProjectsStore();
