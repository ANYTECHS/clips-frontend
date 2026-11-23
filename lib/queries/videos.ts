import apiClient from "../apiClient";
import { VIDEOS_PAGE_SIZE } from "../constants";
import { extractListResponse, getClipsCount } from "./shared";

export const getVideos = async (page = 1, limit = VIDEOS_PAGE_SIZE) => {
  const response = await apiClient.get(`/videos?page=${page}&limit=${limit}`);

  const { items: rawItems, total } = extractListResponse(response.data);

  const items = rawItems.map((video: any) => ({
    ...video,
    clipsCount: getClipsCount(video)
  }));

  return {
    items,
    total,
  };
};
