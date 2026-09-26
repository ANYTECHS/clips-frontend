/**
 * Guardian email helper for social recovery.
 *
 * In production this should be wired to a real transactional email provider.
 * Set RESEND_API_KEY (or SMTP_* vars) and replace the stub below with a call
 * to that provider.
 *
 * For now the implementation logs to stdout so the rest of the recovery flow
 * can be exercised without an email dependency installed.
 *
 * Required env vars (add to .env.local):
 *   EMAIL_FROM=noreply@clipcash.ai
 *   RESEND_API_KEY=re_...          # if using Resend
 *   # --- OR ---
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=...
 *   SMTP_PASS=...
 */

import { logger } from "@/app/lib/logger";

export interface GuardianEmailPayload {
  /** Guardian's email address. */
  to: string;
  /** Account owner's email (shown in the email body). */
  ownerEmail: string;
  /** Opaque token the guardian clicks to approve. */
  approvalToken: string;
  /** ISO timestamp when the session expires. */
  expiresAt: string;
}

/**
 * Sends a guardian approval email.
 *
 * Returns `true` on success, `false` if email delivery fails non-fatally
 * (so the route can decide whether to surface the error or continue).
 *
 * To wire this to Resend: install the `resend` package, construct a client
 * with `process.env.RESEND_API_KEY`, and send a message to `to` with subject
 * `ClipCash: <ownerEmail> is requesting wallet recovery`. Build the body from
 * `approvalUrl` and `expiresAt`, then return `false` if the send reports an
 * error. A prior HTML template for that body is recoverable from git history
 * (it was deleted as unreachable code while this function is still a stub).
 */
export async function sendGuardianApprovalEmail(payload: GuardianEmailPayload): Promise<boolean> {
  const { to, ownerEmail, approvalToken, expiresAt } = payload;
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const approvalUrl = `${appUrl}/api/recovery/approve?token=${encodeURIComponent(approvalToken)}`;

  // Stub: logs instead of sending, so this is safe to run with no email setup.
  logger.info(
    `[recovery-mailer] Guardian email to=${to} | owner=${ownerEmail} | url=${approvalUrl} | expires=${expiresAt}`
  );
  return true;
}
