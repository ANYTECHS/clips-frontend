// Persists the active video-processing job in localStorage for page reloads / resume
const KEY = "clp_active_job";

interface ActiveJob {
  videoId: string;
  startedAt: number;
}

export function saveActiveJob(videoId: string): void {
  if (typeof window === "undefined") return;
  const job: ActiveJob = { videoId, startedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(job));
  } catch {}
}

export function loadActiveJob(): ActiveJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as ActiveJob;
    if (!job?.videoId || job.videoId === "undefined") return null;
    return job;
  } catch {
    return null;
  }
}

export function clearActiveJob(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
