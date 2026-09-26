import { z } from "zod";

/**
 * Request body for PATCH /api/user/profile
 */
export const updateUserProfileBodySchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Request body for POST /api/user/onboarding
 */
export const userOnboardingBodySchema = z.object({
  completed: z.boolean().optional().default(true),
  preferences: z.object({
    defaultStyle: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
  }).optional(),
});

/**
 * Request body for POST /api/user/passkey
 */
export const userPasskeyBodySchema = z.object({
  credentialId: z.string().min(1, "Credential ID is required"),
  publicKey: z.string().min(1, "Public key is required"),
});

export type UpdateUserProfileBody = z.infer<typeof updateUserProfileBodySchema>;
export type UserOnboardingBody = z.infer<typeof userOnboardingBodySchema>;
export type UserPasskeyBody = z.infer<typeof userPasskeyBodySchema>;

/**
 * Body for POST /api/earnings/schedule-report (Issue #820).
 *
 * An explicit boolean rather than a toggle: a retried request must land the
 * same way twice, which a flip would not.
 */
export const scheduleReportBodySchema = z.object({
  enabled: z.boolean(),
});

export type ScheduleReportBody = z.infer<typeof scheduleReportBodySchema>;
