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
  /** True once the async secureStorage rehydration has resolved */
  hasHydrated: boolean;
}

export interface ProcessActions {
  startProcess: (id: string, label: string) => string;
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

/**
 * The status of a single job within a batch transform operation.
 */
export type BatchJobStatus = "queued" | "processing" | "complete" | "error" | "cancelled";

/**
 * A single job entry in a batch transform operation.
 * Tracks per-clip progress and cancellation state.
 */
export interface BatchTransformJob {
  /** Unique job id assigned by the server. */
  jobId: string;
  /** The source clip being transformed. */
  clipId: string;
  /** Current lifecycle status. */
  status: BatchJobStatus;
  /** Completion percentage 0–100. */
  progress: number;
  /** URL of the final transformed video (set on completion). */
  resultUrl: string | null;
  /** Human-readable error if status === "error". */
  errorMessage?: string;
}

/**
 * The overall state of an active batch transform operation.
 */
export interface BatchTransformState {
  /** Unique id for this batch operation. */
  batchId: string;
  /** The visual style applied to all clips. */
  style: string;
  /** All jobs in this batch, keyed by jobId. */
  jobs: Record<string, BatchTransformJob>;
  /** ISO timestamp when the batch was created. */
  createdAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: "free" | "pro" | "enterprise";
  planUsagePercent: number;
  transformQuotaRemaining?: number;
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
  /** Register a callback to be invoked when the user's plan changes */
  onPlanChange: (callback: (newPlan: UserProfile["plan"]) => void) => () => void;
}
