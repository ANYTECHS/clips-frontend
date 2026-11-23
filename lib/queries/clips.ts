import apiClient from "../apiClient";
import {
  CLIPS_FALLBACK_FETCH_LIMIT,
  CLIPS_PAGE_SIZE,
  VIRAL_SCORE_HIGH,
  VIRAL_SCORE_MEDIUM,
} from "../constants";
import { formatDuration } from "./shared";

const scoreKeyFor = (score: number): "high" | "medium" | "low" =>
  score >= VIRAL_SCORE_HIGH ? "high" : score >= VIRAL_SCORE_MEDIUM ? "medium" : "low";

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
        const endpoint = videoId
          ? `/clips?page=1&limit=${CLIPS_FALLBACK_FETCH_LIMIT}`
          : `/clips?page=${page}&limit=${limit}`;
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
      scoreKey: scoreKeyFor(clip.viralScore ?? clip.score ?? 0),
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

export const deleteClip = async (id: string) => {
  await apiClient.delete(`/clips/${id}`);
};


interface ReadyToPostKitPlatformLinks {
  tiktok?: string;
  shorts?: string;
  reels?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  x?: string;
  [key: string]: string | undefined;
}

interface ReadyToPostKitCopyTemplates {
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
