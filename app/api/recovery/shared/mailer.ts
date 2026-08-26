/**
 * Guardian email helper for social recovery.
 *
 * In production this should be wired to a real transactional email provider.
 * Set RESEND_API_KEY (or SMTP_* vars) and uncomment the Resend block below.
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
 */
export async function sendGuardianApprovalEmail(
  payload: GuardianEmailPayload
): Promise<boolean> {
  const { to, ownerEmail, approvalToken, expiresAt } = payload;
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const approvalUrl = `${appUrl}/api/recovery/approve?token=${encodeURIComponent(approvalToken)}`;

  // ── Resend integration (uncomment + install `resend` package) ──────────────
  // import { Resend } from "resend";
  // const resend = new Resend(process.env.RESEND_API_KEY!);
  // const { error } = await resend.emails.send({
  //   from: process.env.EMAIL_FROM ?? "noreply@clipcash.ai",
  //   to,
  //   subject: `ClipCash: ${ownerEmail} is requesting wallet recovery`,
  //   html: buildEmailHtml(ownerEmail, approvalUrl, expiresAt),
  // });
  // if (error) { console.error("[mailer] Resend error:", error); return false; }
  // return true;

  // ── Stub (logs to stdout; safe to run without any email setup) ────────────
  console.info(
    `[recovery-mailer] Guardian email to=${to} | owner=${ownerEmail} | url=${approvalUrl} | expires=${expiresAt}`
  );
  return true;
}

/** Minimal HTML body for the guardian approval email. */
function buildEmailHtml(ownerEmail: string, approvalUrl: string, expiresAt: string): string {
  return `
    <p>Hello,</p>
    <p><strong>${ownerEmail}</strong> has requested to recover their ClipCash wallet and listed you as a trusted guardian.</p>
    <p>Click the button below to approve the request. This link expires on <strong>${expiresAt}</strong>.</p>
    <p><a href="${approvalUrl}" style="background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Approve Recovery</a></p>
    <p>If you did not expect this request, you can safely ignore this email.</p>
    <p>— The ClipCash Team</p>
  `;
}
