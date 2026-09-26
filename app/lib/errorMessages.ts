import { logger } from "@/app/lib/logger";

/**
 * User-facing error message catalogue.
 *
 * ## The standard
 *
 * Every message a user can read is one of two kinds, and the kind determines
 * the shape. Mixing them is what made this codebase inconsistent — `"Checkout
 * error"`, `"Failed to load earnings"`, `"Passwords do not match"` and
 * `"Decryption failed. Check your password and try again."` are four different
 * conventions for the same job.
 *
 * **Validation** — the user can fix this themselves.
 *   1. Imperative, always opening with "Please".
 *   2. Names the field or action, not the rule.
 *   3. Ends with a period.
 *   → `"Please enter your account email address."`
 *
 * **Failure** — the system could not do it, and the user cannot fix it by
 * retyping anything.
 *   1. Opens with "We couldn't", so the failure is not attributed to the user.
 *   2. States what failed in the user's terms, never the system's.
 *   3. Closes with a next step when there is one.
 *   4. Ends with a period.
 *   → `"We couldn't load your wallet. Please try again."`
 *
 * ## Never surface an internal message
 *
 * The single most common defect this catalogue exists to remove is
 * `setError(err.message || "…")`. That renders whatever the thrown `Error`
 * happened to say — `"Request failed with status 502"`, a Prisma constraint
 * name, an endpoint path — directly to the user. `safeErrorMessage` below is
 * the replacement: the real error goes to the log, the user gets the constant.
 *
 * ## Adding a message
 *
 * Add it here rather than inline at the call site. Where the same failure can
 * occur in two places, they should read identically — that is the entire point
 * of the catalogue.
 */

/** The user can resolve these by changing what they typed or selected. */
export const VALIDATION_MESSAGES = {
  /** Login / signup / password-reset email field left empty. */
  emailRequired: "Please enter your account email address.",
  /** Recovery flow, before the mnemonic can be verified. */
  recoveryPasswordRequired: "Please enter your recovery password.",
  /** Backup restore, before the file can be decrypted. */
  backupPasswordRequired: "Please enter your backup password.",
  /** Backup restore with no file chosen. */
  backupFileRequired: "Please select a backup file.",
  /** Signup / reset where the two password fields disagree. */
  passwordsMustMatch: "Passwords must match.",
  /** Social recovery needs a quorum, so two is the floor. */
  guardiansRequired: "Please add at least two guardians with email addresses.",
  /** Moderation rejection needs a reason the creator will read. */
  reasonRequired: "Please include a reason — the creator will see what you write.",
  /** Reset link is absent, malformed, or past its expiry. */
  invalidResetToken: "This reset link is invalid or has expired. Please request a new one.",
  /** Rate limited with no countdown available. */
  tooManyRequests: "Too many requests. Please wait a moment and try again.",
  /** The primary wallet cannot be removed while it is primary. */
  primaryWalletRequired: "Please set another wallet as primary before removing this one.",
} as const;

/** The system could not complete the action. */
export const FAILURE_MESSAGES = {
  /** Last resort. Prefer a specific message; this is for the genuinely unknown. */
  unexpected: "Something went wrong. Please try again.",
  /** A request failed and the caller learns nothing more specific. */
  generic: "We couldn't complete that request. Please try again.",
  /** Wallet connection or balance load. */
  loadWallet: "We couldn't load your wallet. Please try again.",
  /** Global search request. */
  searchFailed: "We couldn't run that search. Please try again.",
  /** Clip upload — both the upload and the create-clip step. */
  uploadFailed: "We couldn't upload your clips. Please try again.",
  /** Earnings dashboard data. */
  loadEarnings: "We couldn't load your earnings. Please try again.",
  /** Referral stats panel. */
  loadReferralStats: "We couldn't load your referral stats. Please try again.",
  /** Billing / checkout handoff. */
  checkoutFailed: "We couldn't start checkout. Please try again.",
  /** Analytics: rate-limit monitoring panel. */
  loadRateLimitMonitoring: "We couldn't load rate limit monitoring. Please try again.",
  /** Analytics: API usage panel. */
  loadApiUsage: "We couldn't load API usage. Please try again.",
  /** Analytics: streaming dashboard. */
  loadAnalytics: "We couldn't load analytics. Please try again.",
  /** The requested project is missing or unreadable. */
  loadProject: "We couldn't load this project. It may have been deleted.",
  /** Monthly report preference could not be read. */
  loadPreference: "We couldn't load your preference. Please try again.",
  /** Monthly report preference could not be written. */
  savePreference: "We couldn't save your preference. Please try again.",
  /** Brand kit: list. */
  loadBrandKits: "We couldn't load your brand kits. Please try again.",
  /** Brand kit: create. */
  createBrandKit: "We couldn't create that brand kit. Please try again.",
  /** Brand kit: update. */
  saveBrandKit: "We couldn't save that brand kit. Please try again.",
  /** Brand kit: set one active. */
  activateBrandKit: "We couldn't set that brand kit as active. Please try again.",
  /** Brand kit: delete. */
  deleteBrandKit: "We couldn't delete that brand kit. Please try again.",
  /** Brand kit: logo image upload. */
  uploadLogo: "We couldn't upload that logo. Please try again.",
  /** Social recovery: mnemonic entry. */
  recoverFromMnemonic:
    "We couldn't recover your wallet from that phrase. Please check it and try again.",
  /** Social recovery: no setup exists for the email entered. */
  findSocialRecovery: "We couldn't find a social recovery setup for that email address.",
  /** Social recovery: dry-run of the recovery transaction. */
  simulationFailed: "We couldn't simulate that recovery. Please try again.",
  /** Backup restore: wrong password or a corrupt file. */
  decryptBackup: "We couldn't decrypt that backup. Please check your password and try again.",
  /** Backup restore: decrypted but could not be applied. */
  restoreFromBackup: "We couldn't restore from that backup. Please try again.",
  /** Embedded wallet creation. */
  createWallet: "We couldn't create your wallet. Please try again.",
  /** Password reset submission. */
  resetPassword: "We couldn't reset your password. Please try again.",
  /** Transformation style picker, loading the catalogue. */
  loadStyles: "We couldn't load transformation styles. Please try again.",
  /** Anime-style preview generation. */
  generatePreview: "We couldn't generate that preview. Please try again.",
  /** Moderation: loading the reviewer's queue. */
  loadReviewQueue: "We couldn't load the review queue. Please try again.",
  /** Moderation: recording an approve/reject decision. */
  recordDecision: "We couldn't record that decision. Please try again.",
  /** Moderation: submitting a creator's appeal. */
  submitAppeal: "We couldn't submit your appeal. Please try again.",
  /** Social recovery: saving the guardian configuration. */
  saveSocialRecovery: "We couldn't save your social recovery settings. Please try again.",
} as const;

/**
 * OAuth provider sign-in failure.
 *
 * Names the provider: with several buttons on the same form, "we couldn't sign
 * you in" leaves the user unsure which one failed, and retrying the wrong one
 * is the likely next action.
 */
export function signInFailed(provider: string): string {
  return `We couldn't sign you in with ${provider}. Please try again.`;
}

/**
 * Rate-limit copy, which needs the remaining wait interpolated.
 *
 * A function rather than a template constant so callers cannot forget to
 * substitute and ship a literal `{{countdown}}` to a user.
 */
export function tooManyAttempts(countdown: string): string {
  return `Too many attempts. Please wait ${countdown} before trying again.`;
}

/**
 * Resolves a caught error to a message that is safe to render.
 *
 * Use this in place of `err instanceof Error ? err.message : "…"` and
 * `err.message || "…"`, both of which render internal text — status codes,
 * endpoint paths, ORM constraint names — to the user.
 *
 * The caught error is logged, so the detail is still recoverable; it just is
 * not the thing the user reads. The caller chooses the constant, because only
 * the caller knows which action failed.
 *
 * ```ts
 * } catch (err) {
 *   setError(safeErrorMessage(err, FAILURE_MESSAGES.loadWallet));
 * }
 * ```
 */
export function safeErrorMessage(error: unknown, fallback: string, context?: string): string {
  logger.error(context ? `[user-facing] ${context}` : "[user-facing] request failed", error);
  return fallback;
}
