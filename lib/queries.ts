import apiClient from "./apiClient";

// Issue #1393 — Pagination metadata: list endpoints return a paginated
// envelope of the shape { items, total, cursor } (legacy arrays and older
// { data, total } shapes are still tolerated).
export interface ListResponse<T = any> {
  items: T[];
  total: number;
  cursor?: string;
}

export const extractListResponse = (data: any): ListResponse<any> => {
  let items: any[] = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data?.data)) items = data.data;
  else if (Array.isArray(data?.clips)) items = data.clips;

  const total =
    typeof data?.total === "number"
      ? data.total
      : Array.isArray(data?.data)
        ? typeof data.data.total === "number"
          ? data.data.total
          : data.data.length
        : items.length;

  const cursor =
    typeof data?.cursor === "string"
      ? data.cursor
      : typeof data?.nextCursor === "string"
        ? data.nextCursor
        : undefined;

  return { items, total, cursor };
};

export const getDashboardData = async () => {
  try {
    const [videosRes, platformsRes] = await Promise.all([
      apiClient.get('/videos?page=1&limit=10'),
      apiClient.get('/platforms')
    ]);

    console.log("[getDashboardData] API responses:", {
      videos: videosRes.data,
      platforms: platformsRes.data
    });

    // Backend returns { data: [...], total, page, limit }
    const videos = videosRes.data.data || (Array.isArray(videosRes.data) ? videosRes.data : []);
    // Backend returns { success, connected, platforms: string[], accountCount }
    const connectedPlatforms = platformsRes.data.accountCount 
      ?? (Array.isArray(platformsRes.data.platforms) ? platformsRes.data.platforms.length : 0);
    
    // Function to get number of clips for a video
    const getClipsCount = (video: any) => {
      if (typeof video.clipsCount === 'number') return video.clipsCount;
      if (Array.isArray(video.clips)) return video.clips.length;
      return 0;
    };
    
    // Count total clips across all videos
    const totalClips = videos.reduce((acc: number, video: any) => acc + getClipsCount(video), 0);

    return {
      stats: {
        clips: totalClips.toString(),
        platforms: connectedPlatforms.toString(),
      },
      projects: videos.slice(0, 6).map((video: any) => ({
        ...video,
        id: video.id,
        title: video.title || "Untitled Video",
        clipsCount: getClipsCount(video),
        status: video.status || "completed",
        thumbnail: video.thumbnail || video.thumbnailUrl || video.thumb || video.coverUrl || video.poster || null,
        videoUrl: video.videoUrl || video.url || video.cloudinaryUrl || video.sourceUrl || null,
        clips: video.clips || [],
      })),
      totalVideos: videosRes.data.total || videos.length,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw error;
  }
};

export const getVideos = async (page = 1, limit = 10) => {
  const response = await apiClient.get(`/videos?page=${page}&limit=${limit}`);
  
  // Function to get number of clips for a video
  const getClipsCount = (video: any) => {
    if (typeof video.clipsCount === 'number') return video.clipsCount;
    if (Array.isArray(video.clips)) return video.clips.length;
    return 0;
  };
  
  const { items: rawItems, total } = extractListResponse(response.data);
  
  // Process each video to ensure clipsCount is set
  const items = rawItems.map((video: any) => ({
    ...video,
    clipsCount: getClipsCount(video)
  }));

  return {
    items,
    total,
  };
};

/** Clips shown per page on the projects list. */
export const CLIPS_PAGE_SIZE = 20;

export const getProjectsData = async (
  videoId?: string,
  page = 1,
  limit = CLIPS_PAGE_SIZE
) => {
  try {
    const extractClips = (resData: any): any[] => {
      if (!resData) return [];
      if (Array.isArray(resData)) return resData;
      if (Array.isArray(resData.data)) return resData.data;
      if (Array.isArray(resData.clips)) return resData.clips;
      if (Array.isArray(resData.data?.clips)) return resData.data.clips;
      if (Array.isArray(resData.video?.clips)) return resData.video.clips;
      return [];
    };

    let rawClips: any[] = [];

    // If videoId is provided, check the video clips endpoint first
    if (videoId) {
      try {
        const clipsRes = await apiClient.get(`/videos/${videoId}/clips?page=${page}&limit=${limit}`);
        rawClips = extractClips(clipsRes.data);
      } catch {
        // Fallback to GET /videos/:id
        try {
          const videoRes = await apiClient.get(`/videos/${videoId}`);
          rawClips = extractClips(videoRes.data);
        } catch { /* continue to generic /clips */ }
      }
    }

    // If still no clips (or videoId wasn't passed), query /clips
    if (rawClips.length === 0) {
      try {
        const endpoint = videoId ? `/clips?page=1&limit=50` : `/clips?page=${page}&limit=${limit}`;
        const response = await apiClient.get(endpoint);
        const allClips = extractClips(response.data);

        if (videoId && allClips.length > 0) {
          const matched = allClips.filter((c: any) => String(c.videoId) === String(videoId));
          rawClips = matched.length > 0 ? matched : allClips;
        } else {
          rawClips = allClips;
        }
      } catch (err) {
        console.warn("[getProjectsData] /clips fetch fallback error:", err);
      }
    }

    return rawClips.map((clip: any) => ({
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      score: clip.viralScore ?? clip.score ?? 0,
      scoreKey: (clip.viralScore ?? clip.score ?? 0) >= 80 ? "high" : (clip.viralScore ?? clip.score ?? 0) >= 50 ? "medium" : "low",
      duration: clip.duration ? formatDuration(clip.duration) : "00:00",
      style: clip.platform || clip.style || "General",
      clipUrl: clip.clipUrl || null,
      readyToPostKit: clip.readyToPostKit || null,
    }));
  } catch (error) {
    console.error("Failed to fetch projects data:", error);
    return [];
  }
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const deleteClip = async (id: string) => {
  await apiClient.delete(`/clips/${id}`);
};

export const getUserClipCount = async (): Promise<number> => {
  try {
    const res = await apiClient.get("/clips?page=1&limit=1");
    if (typeof res.data?.total === "number") return res.data.total;
    if (Array.isArray(res.data)) return res.data.length;
    if (Array.isArray(res.data?.data)) return res.data.total ?? res.data.data.length;
    return 0;
  } catch {
    return 0;
  }
};

export const getUserVideoCount = async (): Promise<number> => {
  try {
    const res = await apiClient.get("/videos?page=1&limit=1");
    if (typeof res.data?.total === "number") return res.data.total;
    if (Array.isArray(res.data)) return res.data.length;
    if (Array.isArray(res.data?.data)) return res.data.total ?? res.data.data.length;
    return 0;
  } catch {
    return 0;
  }
};

/**
 * Checks whether the current user has EVER generated/clipped a project.
 * Queries both /videos (lifetime created videos) and /clips (active clips).
 * Even if the user deletes all clips, the parent video record remains on the backend.
 */
export const checkUserHasEverClipped = async (): Promise<boolean> => {
  try {
    const [videosRes, clipsRes] = await Promise.allSettled([
      apiClient.get("/videos?page=1&limit=1"),
      apiClient.get("/clips?page=1&limit=1"),
    ]);

    let videoTotal = 0;
    if (videosRes.status === "fulfilled") {
      const d = videosRes.value.data;
      if (typeof d?.total === "number") videoTotal = d.total;
      else if (Array.isArray(d)) videoTotal = d.length;
      else if (Array.isArray(d?.data)) videoTotal = d.total ?? d.data.length;
    }

    let clipTotal = 0;
    if (clipsRes.status === "fulfilled") {
      const d = clipsRes.value.data;
      if (typeof d?.total === "number") clipTotal = d.total;
      else if (Array.isArray(d)) clipTotal = d.length;
      else if (Array.isArray(d?.data)) clipTotal = d.total ?? d.data.length;
    }

    return videoTotal > 0 || clipTotal > 0;
  } catch {
    return false;
  }
};

export const getClipById = async (id: string) => {
  const response = await apiClient.get(`/clips/${id}`);
  return response.data;
};

export const createClip = async (data: any) => {
  const response = await apiClient.post(`/clips`, data);
  return response.data;
};

export const updateClip = async (id: string, data: any) => {
  const response = await apiClient.patch(`/clips/${id}`, data);
  return response.data;
};


export interface ReadyToPostKitPlatformLinks {
  tiktok?: string;
  shorts?: string;
  reels?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  x?: string;
  [key: string]: string | undefined;
}

export interface ReadyToPostKitCopyTemplates {
  readyToPost?: string;
  caption?: string;
  hashtags?: string | string[];
  [key: string]: any;
}

export interface ReadyToPostKit {
  downloadUrl?: string;
  copyTemplates?: ReadyToPostKitCopyTemplates;
  platformLinks?: ReadyToPostKitPlatformLinks;
  [key: string]: any;
}

export const getClipReadyToPostKit = async (clipId: string | number): Promise<ReadyToPostKit> => {
  const response = await apiClient.get(`/clips/${clipId}/ready-to-post`);
  return response.data;
};


export interface ClipInfo {
  id: number;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  duration: number | null;
  platform: string | null;
  createdAt: string;
  tippingEnabled: boolean;
  owner: {
    id: number;
    name: string | null;
    username: string | null;
    stellarAddress: string | null;
    walletConnected: boolean;
  };
}

export const getClipInfo = async (id: string): Promise<ClipInfo> => {
  const response = await apiClient.get(`/clips/${id}/info`);
  return response.data;
};

// Pass senderAddress (the tipper's Stellar wallet) so the backend can look up
// confirmed tips by address — no JWT required on this endpoint.

export const getClipDownloadUrl = async (id: string, senderAddress?: string) => {
  const params = senderAddress ? { senderAddress } : {};
  const response = await apiClient.get(`/clips/${id}/download`, { params });
  return response.data;
};


export const getPublicFeed = async (page = 1, limit = 20) => {
  const response = await apiClient.get(`/clips/feed?page=${page}&limit=${limit}`);
  const { items: clips, total } = extractListResponse(response.data);
  return {
    items: clips.map((clip: any) => ({
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      duration: clip.duration ? formatDuration(clip.duration) : "00:00",
      clipUrl: clip.clipUrl || null,
      creatorAddress: clip.creatorAddress || null,
      creatorName: clip.creatorName || null,
      createdAt: clip.createdAt || null,
      readyToPostKit: clip.readyToPostKit || null,
    })),
    total,
  };
};


export const getEarningsData = async () => {
  const response = await apiClient.get('/dashboard/earnings');
  return response.data;
};


export const getUploadProgressUrl = (userId: string, videoId: string) => {
  return `/api/sse/events/upload-progress/${userId}/${videoId}`;
};


export const disconnectPlatform = async (platform: string) => {
  await apiClient.delete(`/platforms/${platform}`);
};


export const postClipToPlatforms = async (clipId: string, platforms: string[]) => {
  const response = await apiClient.post('/platforms/post-clip', {
    clipId,
    platforms,
  });
  return response.data;
};


export const getStellarChallenge = async (stellarAddress: string) => {
  const response = await apiClient.get('/auth/stellar/challenge', {
    params: { stellarAddress },
  });
  return response.data;
};

export const connectStellarWallet = async (stellarAddress: string, signature: string, nonce: string) => {
  const response = await apiClient.post('/auth/stellar/connect', {
    stellarAddress,
    signature,
    nonce,
  });
  return response.data;
};

export const getConnectWalletChallenge = async (stellarAddress: string) => {
  // Requires challenge with purpose: connect
  const response = await apiClient.get('/auth/stellar/connect/challenge', {
    params: { stellarAddress },
  });
  return response.data as { challenge: string; message: string; expiresIn: string };
};

export const disconnectStellarWallet = async () => {
  await apiClient.delete('/auth/stellar/disconnect');
};

export const loginWithStellar = async (stellarAddress: string, signature: string, message: string) => {
  const response = await apiClient.post('/auth/stellar/login', {
    stellarAddress,
    signature,
    message,
  });
  return response.data;
};


export const getClipProof = async (clipId: string) => {
  const response = await apiClient.get(`/clips/${clipId}/proof`);
  return response.data;
};


export const buildTipTransaction = async (clipId: number, amount: string, senderAddress: string) => {
  const response = await apiClient.post('/stellar/tips/build', {
    clipId,
    amount,
    senderAddress,
  });
  return response.data;
};

export const submitTipTransaction = async (clipId: number, signedXdr: string, senderAddress: string) => {
  const response = await apiClient.post('/stellar/tips/submit', {
    clipId,
    signedXdr,
    senderAddress,
  });
  return response.data;
};

export const getTipStatus = async (tipId: string) => {
  const response = await apiClient.get(`/stellar/tips/${tipId}`);
  return response.data;
};


export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await apiClient.patch('/users/me/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};


export const deleteVideo = async (videoId: string) => {
  await apiClient.delete(`/videos/${videoId}`);
};


export const updateVideo = async (videoId: string, data: any) => {
  const response = await apiClient.patch(`/videos/${videoId}`, data);
  return response.data;
};


export interface Agent {
  id: number;
  name: string;
  description: string;
  pricePerJobBNB: string;
  walletAddress: string;
  contractAddress: string;
}

export interface AgentJob {
  id: number;
  contractJobId: string;
  videoUrl: string;
  style: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  clientAddress: string;
  txHash: string;
  resultClipIds: number[];
  agentId: number;
  createdAt: string;
  clips?: any[];
  readyToPostKit?: ReadyToPostKit | null;
}

export const getAgents = async (): Promise<Agent[]> => {
  const res = await apiClient.get("/agents");
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
};

export const getAgentById = async (id: number): Promise<Agent> => {
  const res = await apiClient.get(`/agents/${id}`);
  return res.data;
};

export const getAgentJobs = async (): Promise<AgentJob[]> => {
  const res = await apiClient.get("/agent/jobs");
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
};

export const getAgentJob = async (jobId: number): Promise<AgentJob> => {
  const res = await apiClient.get(`/agent/jobs/${jobId}`);
  return res.data;
};

export const createAgentJob = async (data: {
  videoUrl: string;
  clientAddress: string;
  style?: string;
  contractJobId?: string;
  txHash?: string;
}): Promise<AgentJob> => {
  const res = await apiClient.post("/agent/jobs", data);
  return res.data;
};


export interface StellarSubscription {
  id: number;
  plan: "STARTER" | "CREATOR" | "PRO";
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  startsAt: string;
  expiresAt: string;
  stellarAddress: string;
}

export const buildAgentPaymentXdr = async (data: {
  senderAddress: string;
  videoUrl: string;
  style?: string;
}): Promise<{ xdr: string; memo: string; amount: string }> => {
  const res = await apiClient.post("/stellar/agent/build-payment", {
    senderAddress: data.senderAddress,
    videoUrl: data.videoUrl,
    style: data.style,
  });
  return res.data;
};

export const hireAgent = async (data: {
  senderAddress: string;
  videoUrl: string;
  style?: string;
  signedXdr?: string;
}): Promise<AgentJob> => {
  const res = await apiClient.post("/stellar/agent/hire", {
    senderAddress: data.senderAddress,
    videoUrl: data.videoUrl,
    style: data.style,
    ...(data.signedXdr ? { signedXdr: data.signedXdr } : {}),
  });
  return res.data;
};

export const getStellarAgentJob = async (jobId: number): Promise<AgentJob> => {
  const res = await apiClient.get(`/stellar/agent/jobs/${jobId}`);
  return res.data;
};

export const getMySubscription = async (): Promise<StellarSubscription | null> => {
  try {
    const res = await apiClient.get("/stellar/subscriptions/my");
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};

export const buildSubscriptionPaymentXdr = async (data: {
  senderAddress: string;
  plan: "STARTER" | "CREATOR" | "PRO";
}): Promise<{ xdr: string; amount: string; plan: string }> => {
  const res = await apiClient.post("/stellar/subscriptions/build-payment", data);
  return res.data;
};

export const activateSubscription = async (data: {
  senderAddress: string;
  plan: "STARTER" | "CREATOR" | "PRO";
  signedXdr: string;
}): Promise<StellarSubscription> => {
  const res = await apiClient.post("/stellar/subscriptions/activate", data);
  return res.data;
};

export const cancelSubscription = async (): Promise<void> => {
  await apiClient.post("/stellar/subscriptions/cancel");
};
