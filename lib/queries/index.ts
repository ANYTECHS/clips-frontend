// Public entry point for backend data queries (`@/lib/queries`).
//
// The queries are split by domain (issue #1349) so each module has a single
// responsibility; this barrel keeps the existing import path working.

export { getDashboardData, getUserClipCount, checkUserHasEverClipped, getEarningsData } from "./dashboard";
export { getVideos } from "./videos";
export {
  getProjectsData,
  deleteClip,
  getClipReadyToPostKit,
  getClipInfo,
  getClipDownloadUrl,
} from "./clips";
export type { ReadyToPostKit, ClipInfo } from "./clips";
export { disconnectPlatform } from "./platforms";
export {
  connectStellarWallet,
  getConnectWalletChallenge,
  disconnectStellarWallet,
  buildTipTransaction,
  submitTipTransaction,
  getTipStatus,
} from "./stellar";
export { getAgents, buildAgentPaymentXdr, hireAgent } from "./agents";
export type { Agent, AgentJob } from "./agents";
export {
  getMySubscription,
  buildSubscriptionPaymentXdr,
  activateSubscription,
} from "./subscriptions";
export type { StellarSubscription } from "./subscriptions";
