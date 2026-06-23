/**
 * Store barrel export
 *
 * Import stores and selectors from here rather than from individual files.
 * This keeps refactoring contained — if a store moves, only this file changes.
 *
 * Example:
 *   import { useDashboardStore, selectStats } from "@/app/store";
 *   import { useUserStore, selectUserName } from "@/app/store";
 *   import { useProcessStore, selectProcess } from "@/app/store";
 */

// Dashboard
export {
  useDashboardStore,
  selectStats,
  selectRevenueTrend,
  selectRecentProjects,
  selectDashboardMeta,
} from "./dashboardStore";

// Earnings
export {
  useEarningsStore,
  selectEarningsTotals,
  selectEarningsBreakdown,
  selectEarningsMeta,
} from "./earningsStore";

// Process
export {
  useProcessStore,
  selectProcess,
  selectProcessStatus,
  selectProcessProgress,
  defaultProcessState,
} from "./processStore";

// User
export {
  useUserStore,
  selectUserProfile,
  selectUserName,
  selectUserEmail,
  selectUserAvatar,
  selectPlanUsage,
  selectUserLoading,
} from "./userStore";

// Types (re-exported for convenience)
export type {
  DashboardState,
  DashboardActions,
  DashboardStats,
  EarningsStats,
  ClipsStats,
  PlatformsStats,
  RevenuePoint,
  Project,
  ProcessState,
  ProcessActions,
  ProcessStatus,
  UserProfile,
  UserState,
  UserActions,
  EarningsBreakdownItem,
  EarningsState,
  EarningsActions,
} from "./types";
