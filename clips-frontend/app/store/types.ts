/**
 * Shared types for all Zustand stores.
 * Keep this file free of store logic — types only.
 */

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface EarningsStats {
  total: string;
  trend: number;
  trendLabel: string;
}

export interface ClipsStats {
  total: number;
  trend: number;
  trendLabel: string;
}

export interface PlatformsStats {
  total: number;
  trend: number;
  trendLabel: string;
}

export interface DashboardStats {
  earnings: EarningsStats;
  clips: ClipsStats;
  platforms: PlatformsStats;
}

export interface RevenuePoint {
  date: string;
  amount: number;
}

export interface Project {
  id: string;
  title: string;
  clipsGenerated: number;
  status: "processing" | "completed";
  image?: string;
  accent?: string;
}

export interface DashboardState {
  stats: DashboardStats | null;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
  /** ISO timestamp of the last successful fetch — used for cache invalidation */
  lastFetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

export interface DashboardActions {
  fetchDashboard: () => Promise<void>;
  /** Force a re-fetch even if the cache is still fresh */
  invalidateCache: () => void;
  setRecentProjects: (projects: Project[]) => void;
}

// ─── Process ──────────────────────────────────────────────────────────────────

export type ProcessStatus = "idle" | "processing" | "complete" | "error";

export interface ProcessState {
  id: string;
  label: string;
  progress: number; // 0–100
  status: ProcessStatus;
  startedAt: number | null;
  completedAt: number | null;
  momentsFound: number;
  estimatedSecondsRemaining: number | null;
}

export interface ProcessActions {
  startProcess: (id: string, label: string) => void;
  update: (
    patch:
      | Partial<ProcessState>
      | ((prev: ProcessState) => Partial<ProcessState>)
  ) => void;
  resetProcess: () => void;
}

// ─── Earnings ─────────────────────────────────────────────────────────────────

/** A single line-item in the earnings breakdown (e.g. per platform or per clip) */
export interface EarningsBreakdownItem {
  id: string;
  label: string;
  amount: number;
  /** ISO date string */
  date: string;
  platform: "tiktok" | "instagram" | "youtube" | "other";
}

export interface EarningsState {
  /** Aggregated totals — mirrors DashboardStats.earnings but owned here */
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  
  /** Granular summary cards data */
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };

  breakdown: EarningsBreakdownItem[];
  /** ISO timestamp of the last successful fetch */
  lastFetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

export interface EarningsActions {
  fetchEarnings: () => Promise<void>;
  invalidateEarningsCache: () => void;
}

// ─── Batch Transform ──────────────────────────────────────────────────────────

export type TransformStyle =
  | "Bold & Dynamic"
  | "Minimalist"
  | "Emoji-Rich"
  | "Subtitles Only"
  | string;

/** Options forwarded to the AI transform pipeline (all optional) */
export interface TransformOptions {
  /** Target aspect ratio, e.g. "9:16" for TikTok */
  aspectRatio?: string;
  /** Whether to burn subtitles into the clip */
  burnSubtitles?: boolean;
  /** Speed multiplier, e.g. 1.25 */
  speed?: number;
}

export type TransformJobStatus =
  | "queued"
  | "processing"
  | "complete"
  | "error"
  | "cancelled";

/** One transform job corresponds to one clip being processed */
export interface TransformJob {
  jobId: string;
  clipId: string;
  clipTitle: string;
  style: TransformStyle;
  options?: TransformOptions;
  status: TransformJobStatus;
  /** 0–100 */
  progress: number;
  error?: string;
}

export interface BatchTransformState {
  /** Ordered list of transform jobs in the current batch */
  jobs: TransformJob[];
  /** Whether the queue panel is visible */
  isQueueOpen: boolean;
}

export interface BatchTransformActions {
  /**
   * Kick off a batch — replaces any in-progress batch with a fresh one.
   * Each clipId generates one job at status "queued".
   */
  startBatch: (
    clipIds: string[],
    clipTitles: Record<string, string>,
    style: TransformStyle,
    options?: TransformOptions
  ) => void;
  /** Simulate (or receive) a progress update for a single job */
  updateJob: (jobId: string, patch: Partial<TransformJob>) => void;
  /** Cancel a single job */
  cancelJob: (jobId: string) => void;
  /** Cancel all pending / processing jobs */
  cancelAll: () => void;
  /** Remove completed / errored / cancelled jobs, keeping processing ones */
  clearFinished: () => void;
  /** Toggle the queue panel open/closed */
  toggleQueue: (open?: boolean) => void;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: "free" | "pro" | "enterprise";
  planUsagePercent: number;
}

export interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface UserActions {
  fetchUser: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  clearUser: () => void;
}
