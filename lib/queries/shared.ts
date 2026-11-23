import { SECONDS_PER_MINUTE } from "../constants";

// Response-normalisation helpers shared by the query modules. The backend
// returns lists in several shapes ({ items }, { data }, { clips } or a bare
// array), so callers go through these helpers instead of guessing.

interface ListResponse<T = any> {
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

/** Number of clips attached to a video record, whichever field carries it. */
export const getClipsCount = (video: any): number => {
  if (typeof video.clipsCount === "number") return video.clipsCount;
  if (Array.isArray(video.clips)) return video.clips.length;
  return 0;
};

/** Reads a list total from the backend's various paginated shapes. */
export const extractTotal = (data: any): number => {
  if (typeof data?.total === "number") return data.total;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data)) return data.total ?? data.data.length;
  return 0;
};

/** Formats a duration in seconds as mm:ss. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / SECONDS_PER_MINUTE).toString().padStart(2, "0");
  const s = Math.floor(seconds % SECONDS_PER_MINUTE).toString().padStart(2, "0");
  return `${m}:${s}`;
}
