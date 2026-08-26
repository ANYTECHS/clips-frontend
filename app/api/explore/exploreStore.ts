export interface ExploreClip {
  id: string;
  userId: string;
  creatorUsername: string;
  title: string;
  thumbnail: string;
  score: number;
  style: string;
  duration: string;
  videoUrl: string;
  isPublic: boolean;
  shareId: string;
  createdAt: string;
}

export interface UserPrivacySettings {
  userId: string;
  exploreOptIn: boolean;
  showUsername: boolean;
}

class PrivacyStore {
  private settings = new Map<string, UserPrivacySettings>();

  get(userId: string): UserPrivacySettings {
    return (
      this.settings.get(userId) ?? {
        userId,
        exploreOptIn: false,
        showUsername: true,
      }
    );
  }

  update(userId: string, update: Partial<Pick<UserPrivacySettings, "exploreOptIn" | "showUsername">>): UserPrivacySettings {
    const current = this.get(userId);
    const next = { ...current, ...update, userId };
    this.settings.set(userId, next);
    return next;
  }
}

export const privacyStore = new PrivacyStore();

class ExploreStore {
  private clips: ExploreClip[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    const creators = ["viralVibes", "clipMaster", "trendSetter", "contentKing", "shortFormPro"];
    const styles = ["Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];
    const thumbs = ["/projects/thumb1.png", "/projects/thumb2.png", "/projects/thumb3.png"];

    this.clips = Array.from({ length: 40 }, (_, i) => ({
      id: `explore-clip-${i + 1}`,
      userId: `creator-${(i % 5) + 1}`,
      creatorUsername: creators[i % creators.length],
      title: `Trending Clip #${String(i + 1).padStart(2, "0")}`,
      thumbnail: thumbs[i % thumbs.length],
      score: 95 - (i % 30),
      style: styles[i % styles.length],
      duration: `00:${String(30 + (i % 30)).padStart(2, "0")}`,
      videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      isPublic: true,
      shareId: `explore-clip-${i + 1}-share`,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    }));
  }

  getTrending(options: {
    cursor?: string;
    limit?: number;
    privacyFilter?: (clip: ExploreClip) => ExploreClip | null;
  }): { clips: ExploreClip[]; nextCursor: string | null } {
    const limit = options.limit ?? 20;
    let filtered = this.clips.filter((c) => c.isPublic);

    if (options.privacyFilter) {
      filtered = filtered
        .map(options.privacyFilter)
        .filter((c): c is ExploreClip => c !== null);
    }

    filtered.sort((a, b) => b.score - a.score);

    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = filtered.findIndex((c) => c.id === options.cursor);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const page = filtered.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < filtered.length ? page[page.length - 1]?.id ?? null : null;

    return { clips: page, nextCursor };
  }

  getByShareId(shareId: string): ExploreClip | undefined {
    return this.clips.find((c) => c.shareId === shareId && c.isPublic);
  }

  getById(id: string): ExploreClip | undefined {
    return this.clips.find((c) => c.id === id && c.isPublic);
  }
}

export const exploreStore = new ExploreStore();
