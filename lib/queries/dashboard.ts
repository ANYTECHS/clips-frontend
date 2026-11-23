import apiClient from "../apiClient";
import { DASHBOARD_RECENT_PROJECTS, VIDEOS_PAGE_SIZE } from "../constants";
import { extractTotal, getClipsCount } from "./shared";

export const getDashboardData = async () => {
  try {
    const [videosRes, platformsRes] = await Promise.all([
      apiClient.get(`/videos?page=1&limit=${VIDEOS_PAGE_SIZE}`),
      apiClient.get('/platforms')
    ]);

    console.log("[getDashboardData] API responses:", {
      videos: videosRes.data,
      platforms: platformsRes.data
    });

   
    const videos = videosRes.data.data || (Array.isArray(videosRes.data) ? videosRes.data : []);
    // Backend returns { success, connected, platforms: string[], accountCount }
    const connectedPlatforms = platformsRes.data.accountCount 
      ?? (Array.isArray(platformsRes.data.platforms) ? platformsRes.data.platforms.length : 0);
    
    // Count total clips across all videos
    const totalClips = videos.reduce((acc: number, video: any) => acc + getClipsCount(video), 0);

    return {
      stats: {
        clips: totalClips.toString(),
        platforms: connectedPlatforms.toString(),
      },
      projects: videos.slice(0, DASHBOARD_RECENT_PROJECTS).map((video: any) => ({
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

export const getUserClipCount = async (): Promise<number> => {
  try {
    const res = await apiClient.get("/clips?page=1&limit=1");
    return extractTotal(res.data);
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

    const videoTotal = videosRes.status === "fulfilled" ? extractTotal(videosRes.value.data) : 0;
    const clipTotal = clipsRes.status === "fulfilled" ? extractTotal(clipsRes.value.data) : 0;

    return videoTotal > 0 || clipTotal > 0;
  } catch {
    return false;
  }
};

export const getEarningsData = async () => {
  const response = await apiClient.get('/dashboard/earnings');
  return response.data;
};
