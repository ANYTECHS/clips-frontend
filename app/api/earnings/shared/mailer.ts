/**
 * app/api/earnings/shared/mailer.ts
 *
 * Transactional email for the monthly earnings report (Issue #820).
 *
 * Mirrors the shape of `app/api/recovery/shared/mailer.ts` — a provider call
 * behind a stub that logs — but adds attachment support, which the report
 * needs and the recovery mail does not.
 *
 * Required env vars:
 *   EMAIL_FROM=noreply@clipcash.ai
 *   RESEND_API_KEY=re_...
 *
 * With none of them set the send is logged and reported as success, so the
 * cron path can be exercised end to end without an email dependency. That is
 * deliberate for development and wrong for production, which is why
 * `isEmailConfigured` is exported and the cron route reports it.
 */

import { logger } from "@/app/lib/logger";

export interface EmailAttachment {
  filename: string;
  /** Raw file content. Base64-encoded before it goes to the provider. */
  content: string;
  contentType: string;
}

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export type SendResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

/** True when a real provider is configured. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Sends one transactional email.
 *
 * Never throws — the caller is a cron sweep over many users, and one bad
 * address must not abort the run for everyone after it.
 */
export async function sendTransactionalEmail(
  email: TransactionalEmail,
): Promise<SendResult> {
  if (!isEmailConfigured()) {
    logger.info(
      `[earnings-mailer] Email not configured; would send "${email.subject}" to ${email.to}` +
        (email.attachments?.length
          ? ` with ${email.attachments.length} attachment(s)`
          : ""),
    );
    return { ok: true, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: email.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf8").toString("base64"),
          content_type: a.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `Provider rejected (${response.status}): ${detail}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email request failed",
    };
  }
}
