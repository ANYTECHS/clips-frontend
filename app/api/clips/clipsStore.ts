// Simple in-memory mock store for clips

export interface ScoreBreakdown {
  hook: number;
  retention: number;
  emotional: number;
  trending: number;
}

export interface Clip {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  thumbnail: string;
  score: number;
  scoreKey: string;
  duration: string;
  style: string;
  status: string;
  resolution: string;
  videoUrl: string;
  createdAt: string;
  /** Tags for organizing clips by topic, campaign, or style. Max 10 tags per clip. */
  tags?: string[];
  /** Set by a soft delete. Excluded from every read path once present. */
  deletedAt?: string | null;
  /** Set by archiving. Surfaced only under the "Archived" filter. */
  archivedAt?: string | null;
}

class ClipsStore {
  private clips: Clip[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    // Generate some mock clips to use as baseline
    const mockClips = [
      { id: "1", title: "Clip #01 - The Big Reveal Hook", thumbnail: "/projects/thumb1.png", score: 94, scoreKey: "high", duration: "00:45", style: "Bold & Dynamic", status: "pending", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", scoreBreakdown: { hook: 96, retention: 92, emotional: 90, trending: 98 }, tags: ["tutorial", "hook"] },
      { id: "2", title: "Clip #02 - Technical Deep Dive", thumbnail: "/projects/thumb2.png", score: 68, scoreKey: "medium", duration: "00:58", style: "Minimalist", status: "listed", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", scoreBreakdown: { hook: 70, retention: 65, emotional: 60, trending: 75 }, tags: ["technical", "education"] },
      { id: "3", title: "Clip #03 - Audience Reaction", thumbnail: "/projects/thumb3.png", score: 82, scoreKey: "high", duration: "00:32", style: "Emoji-Rich", status: "pending", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", scoreBreakdown: { hook: 85, retention: 80, emotional: 88, trending: 75 }, tags: ["reactions", "engagement"] },
      { id: "4", title: "Clip #04 - Feature Walkthrough", thumbnail: "/projects/thumb1.png", score: 91, scoreKey: "high", duration: "00:52", style: "Subtitles Only", status: "history", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", scoreBreakdown: { hook: 92, retention: 90, emotional: 85, trending: 95 }, tags: ["tutorial", "product"] },
      { id: "5", title: "Clip #05 - Closing Remarks", thumbnail: "/projects/thumb2.png", score: 42, scoreKey: "low", duration: "01:12", style: "Minimalist", status: "pending", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", scoreBreakdown: { hook: 45, retention: 40, emotional: 38, trending: 45 }, tags: ["outro"] },
      { id: "6", title: "Clip #06 - Product Detail B-Roll", thumbnail: "/projects/thumb3.png", score: 89, scoreKey: "high", duration: "00:44", style: "Bold & Dynamic", status: "listed", resolution: "1080x1920", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", scoreBreakdown: { hook: 90, retention: 88, emotional: 85, trending: 92 }, tags: ["product", "broll", "campaign-q4"] },
    ];
    
    // Create base pool that users will pull from 
    this.clips = mockClips.map((clip, idx) => ({
      ...clip,
      userId: "default", // will be replaced when requested
      projectId: `default-proj-${(idx % 3) + 1}`,
      createdAt: new Date().toISOString()
    }));
  }

  /**
   * Gets a user's clips, seeding them if they don't exist yet.
   *
   * Soft-deleted clips are never returned — callers that need them (a restore
   * flow, or a purge job) must go through `getDeletedClipsForUser`.
   */
  getClipsForUser(userId: string, options: { includeArchived?: boolean } = {}): Clip[] {
    const existing = this.clips.filter(c => c.userId === userId);

    // If no clips exist for this user, duplicate the seed pool for them
    if (existing.length === 0) {
      const newClips = this.clips.filter(c => c.userId === "default").map((c, idx) => ({
        ...c,
        id: `${userId}-clip-${idx}`,
        userId,
        projectId: `${userId}-proj-${(idx % 3) + 1}`,
      }));
      this.clips.push(...newClips);
      return newClips;
    }

    return existing.filter(clip => {
      if (clip.deletedAt) return false;
      // Archived clips are hidden from the default library, the Vault, and
      // Analytics; only the Archived filter asks for them.
      if (clip.archivedAt && !options.includeArchived) return false;
      return true;
    });
  }

  /** Archived clips only — backs the "Archived" tab. */
  getArchivedClipsForUser(userId: string): Clip[] {
    return this.clips.filter(
      c => c.userId === userId && !c.deletedAt && Boolean(c.archivedAt),
    );
  }

  /** Soft-deleted clips, for restore or purge flows. */
  getDeletedClipsForUser(userId: string): Clip[] {
    return this.clips.filter(c => c.userId === userId && Boolean(c.deletedAt));
  }

  updateClipStatus(userId: string, clipIds: string[], status: string) {
    let updatedCount = 0;
    this.clips = this.clips.map(clip => {
      if (clip.userId === userId && clipIds.includes(clip.id)) {
        updatedCount++;
        return { ...clip, status };
      }
      return clip;
    });
    return updatedCount;
  }

  /**
   * Soft-deletes clips by stamping `deletedAt`. Already-deleted clips are
   * skipped so a repeated request does not move the timestamp, which would
   * restart the retention window.
   */
  softDeleteClips(userId: string, clipIds: string[]): number {
    const deletedAt = new Date().toISOString();
    let deletedCount = 0;

    this.clips = this.clips.map(clip => {
      if (clip.userId === userId && clipIds.includes(clip.id) && !clip.deletedAt) {
        deletedCount++;
        return { ...clip, deletedAt };
      }
      return clip;
    });

    return deletedCount;
  }

  /** Permanently drops soft-deleted clips — used by the retention job. */
  purgeDeletedClips(olderThan: Date): number {
    const cutoff = olderThan.getTime();
    const before = this.clips.length;

    this.clips = this.clips.filter(clip => {
      if (!clip.deletedAt) return true;
      return new Date(clip.deletedAt).getTime() > cutoff;
    });

    return before - this.clips.length;
  }

  /** Archives clips by stamping `archivedAt`; deleted clips are untouched. */
  archiveClips(userId: string, clipIds: string[]): number {
    const archivedAt = new Date().toISOString();
    let archivedCount = 0;

    this.clips = this.clips.map(clip => {
      if (
        clip.userId === userId &&
        clipIds.includes(clip.id) &&
        !clip.deletedAt &&
        !clip.archivedAt
      ) {
        archivedCount++;
        return { ...clip, archivedAt };
      }
      return clip;
    });

    return archivedCount;
  }

  /** Clears `archivedAt`, returning clips to the main library. */
  unarchiveClips(userId: string, clipIds: string[]): number {
    let restoredCount = 0;

    this.clips = this.clips.map(clip => {
      if (
        clip.userId === userId &&
        clipIds.includes(clip.id) &&
        !clip.deletedAt &&
        clip.archivedAt
      ) {
        restoredCount++;
        return { ...clip, archivedAt: null };
      }
      return clip;
    });

    return restoredCount;
  }

  /** Updates tags for a single clip. */
  updateClipTags(userId: string, clipId: string, tags: string[]): boolean {
    let updated = false;

    this.clips = this.clips.map(clip => {
      if (clip.userId === userId && clip.id === clipId && !clip.deletedAt) {
        updated = true;
        return { ...clip, tags };
      }
      return clip;
    });

    return updated;
  }

  /** Gets all unique tags across a user's clips (for autocomplete/suggestions). */
  getAllTagsForUser(userId: string): string[] {
    const tagSet = new Set<string>();
    
    this.clips
      .filter(c => c.userId === userId && !c.deletedAt && c.tags)
      .forEach(clip => {
        clip.tags?.forEach(tag => tagSet.add(tag));
      });

    return Array.from(tagSet).sort();
  }

  /**
   * Ownership check used by the mutating routes. Returns the ids that do not
   * belong to the user, so the caller can 403 before mutating anything.
   */
  findUnownedClipIds(userId: string, clipIds: string[]): string[] {
    const owned = new Set(
      this.clips.filter(c => c.userId === userId).map(c => c.id),
    );
    return clipIds.filter(id => !owned.has(id));
  }

  getClipsForProject(userId: string, projectId: string): Clip[] {
    return this.getClipsForUser(userId).filter((c) => c.projectId === projectId);
  }

  /** Cascade soft-delete all clips belonging to a project. */
  softDeleteClipsByProject(userId: string, projectId: string): number {
    const clipIds = this.clips
      .filter((c) => c.userId === userId && c.projectId === projectId && !c.deletedAt)
      .map((c) => c.id);
    return this.softDeleteClips(userId, clipIds);
  }
}

export const clipsStore = new ClipsStore();
