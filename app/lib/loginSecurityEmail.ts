/**
 * app/lib/loginSecurityEmail.ts
 *
 * Builds and dispatches the "suspicious login" alert email.
 *
 * The email includes:
 *   - Approximate location (city + country)
 *   - Device / user-agent string
 *   - The reason(s) the login was flagged
 *   - A "Not you? Revoke this session" CTA that calls
 *     DELETE /api/auth/sessions/:id via a signed one-click URL
 *
 * The revocation link is an authenticated API link.  Because clicking a link
 * in an email cannot carry session cookies, we use a time-limited HMAC token
 * (session-id + expiry) so the endpoint can verify the request without
 * requiring a full login.  The endpoint validates the token and calls
 * prisma.userSession.update({ revokedAt }) directly.
 */

import crypto from "crypto";
import { sendTransactionalEmail } from "@/app/api/earnings/shared/mailer";
import { logger } from "@/app/lib/logger";
import type { AnomalyReason } from "@/app/lib/loginSecurity";

// ---------------------------------------------------------------------------
// HMAC token helpers
// ---------------------------------------------------------------------------

const TOKEN_TTL_MS = 48 * 60 * 60 * 1_000; // 48 hours

/**
 * Generates a time-limited HMAC token that authorises revoking `sessionId`
 * without being logged in.  The token encodes the session ID and an expiry
 * timestamp so it cannot be replayed after 48 hours.
 */
export function generateRevocationToken(sessionId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "dev-secret";
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${sessionId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  // Base64-URL encode so the token is safe in a URL query parameter
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Validates a revocation token and returns the session ID if valid.
 *
 * @returns The session ID on success, or null if invalid / expired.
 */
export function validateRevocationToken(token: string): string | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET ?? "dev-secret";
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payloadPart = decoded.slice(0, lastColon);
    const receivedSig = decoded.slice(lastColon + 1);

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadPart)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(receivedSig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    // payloadPart is "sessionId:expiresAt"
    const colonIndex = payloadPart.lastIndexOf(":");
    const sessionId = payloadPart.slice(0, colonIndex);
    const expiresAt = parseInt(payloadPart.slice(colonIndex + 1), 10);

    if (Date.now() > expiresAt) return null;

    return sessionId;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email building
// ---------------------------------------------------------------------------

export interface SuspiciousLoginAlertParams {
  userEmail: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  country: string;
  city: string;
  reasons: AnomalyReason[];
  distanceKm?: number;
  impliedSpeedKmh?: number;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[ch];
  });
}

function buildReasonText(
  reasons: AnomalyReason[],
  distanceKm?: number,
  impliedSpeedKmh?: number,
): { plain: string; html: string } {
  const lines: string[] = [];

  if (reasons.includes("new_country")) {
    lines.push("• Login from a new country not seen before on your account.");
  }

  if (reasons.includes("impossible_travel")) {
    const detail =
      distanceKm !== undefined && impliedSpeedKmh !== undefined
        ? ` (${distanceKm.toLocaleString()} km in a timeframe that implies ${impliedSpeedKmh.toLocaleString()} km/h)`
        : "";
    lines.push(
      `• Impossible travel detected — two locations are geographically inconsistent${detail}.`,
    );
  }

  const plain = lines.join("\n");
  const html = lines.map((l) => `<li>${escapeHtml(l.slice(2))}</li>`).join("");
  return { plain, html: `<ul>${html}</ul>` };
}

/**
 * Sends a suspicious-login alert email to `userEmail`.
 * Never throws — returns false on failure so the caller can log and continue.
 */
export async function sendSuspiciousLoginAlert(
  params: SuspiciousLoginAlertParams,
): Promise<boolean> {
  const {
    userEmail,
    sessionId,
    ipAddress,
    userAgent,
    country,
    city,
    reasons,
    distanceKm,
    impliedSpeedKmh,
  } = params;

  const appUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const revocationToken = generateRevocationToken(sessionId);
  const revokeUrl = `${appUrl}/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke?token=${encodeURIComponent(revocationToken)}`;
  const dashboardUrl = `${appUrl}/dashboard/sessions`;

  const location =
    city && country ? `${escapeHtml(city)}, ${escapeHtml(country)}` : escapeHtml(country || "Unknown");

  const { plain: reasonPlain, html: reasonHtml } = buildReasonText(
    reasons,
    distanceKm,
    impliedSpeedKmh,
  );

  const subject = "New login detected on your ClipCash account";

  const text = [
    "Hi,",
    "",
    "We detected a new login to your ClipCash account that looks unusual.",
    "",
    "Details:",
    `  Location : ${city ? `${city}, ` : ""}${country}`,
    `  IP address: ${ipAddress}`,
    `  Device   : ${userAgent}`,
    "",
    "Why we flagged this:",
    reasonPlain,
    "",
    "If this was you, no action is needed.",
    "",
    "If this was NOT you, revoke this session immediately:",
    revokeUrl,
    "",
    "You can also manage all your active sessions here:",
    dashboardUrl,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">

          <!-- Header -->
          <tr>
            <td style="background:#ef4444;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                ⚠ Suspicious login detected
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">
                We detected a new sign-in to your <strong>ClipCash</strong> account
                that looks unusual.
              </p>

              <!-- Detail table -->
              <table role="presentation" width="100%" style="background:#f9fafb;border-radius:6px;padding:16px;margin-bottom:20px;font-size:14px;color:#374151;">
                <tr>
                  <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Location</td>
                  <td style="padding:4px 8px;">${location}</td>
                </tr>
                <tr>
                  <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">IP address</td>
                  <td style="padding:4px 8px;">${escapeHtml(ipAddress)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Device</td>
                  <td style="padding:4px 8px;word-break:break-all;">${escapeHtml(userAgent)}</td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#374151;font-size:14px;font-weight:600;">
                Why we flagged this:
              </p>
              <div style="color:#374151;font-size:14px;margin-bottom:24px;">
                ${reasonHtml}
              </div>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
                If this was you, no action is needed. Your account is secure.
              </p>

              <!-- Primary CTA -->
              <table role="presentation" width="100%" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(revokeUrl)}"
                       style="display:inline-block;background:#ef4444;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:6px;text-decoration:none;">
                      Not you? Revoke this session
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Secondary link -->
              <p style="margin:0;text-align:center;color:#6b7280;font-size:13px;">
                Or
                <a href="${escapeHtml(dashboardUrl)}" style="color:#3b82f6;">
                  manage all active sessions
                </a>
                from your account dashboard.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;color:#9ca3af;font-size:12px;text-align:center;">
              ClipCash &mdash; you received this because a new session was created on your account.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await sendTransactionalEmail({
    to: userEmail,
    subject,
    text,
    html,
  });

  if (!result.ok) {
    logger.warn("[LoginSecurity] Failed to send suspicious-login alert", {
      userEmail,
      sessionId,
      error: result.error,
    });
    return false;
  }

  logger.info("[LoginSecurity] Suspicious-login alert sent", {
    userEmail,
    sessionId,
    reasons,
  });

  return true;
}
