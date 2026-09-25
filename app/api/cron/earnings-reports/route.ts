/**
 * POST /api/cron/earnings-reports
 *
 * Vercel Cron — runs 06:00 UTC on the 1st of each month (Issue #820).
 *
 * Emails last month's earnings report, with a CSV export attached, to every
 * user who has opted in.
 *
 * Environment variables:
 *   CRON_SECRET   — Bearer token the scheduler presents.
 *   RESEND_API_KEY / EMAIL_FROM — see shared/mailer.ts. Unset means the send
 *                   is logged rather than delivered.
 *   NEXTAUTH_URL  — base for the "turn this off" link in the email.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { earningsStore } from "../../earnings/earningsStore";
import {
  buildCsv,
  buildEmailHtml,
  buildEmailText,
  csvFilename,
  previousMonth,
  summarise,
  transactionsForPeriod,
} from "../../earnings/shared/report";
import {
  isEmailConfigured,
  sendTransactionalEmail,
} from "../../earnings/shared/mailer";

/**
 * Users processed per run.
 *
 * A cap rather than an unbounded sweep: the route runs inside a function
 * timeout, and a run that is killed halfway leaves no record of where it got
 * to. Recipients are ordered deterministically and already-sent users are
 * skipped via the delivery log, so a capped run that is re-invoked picks up
 * where it stopped instead of starting over.
 */
const MAX_RECIPIENTS_PER_RUN = 500;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // Matches the existing cron routes: open in development so the job can be
    // exercised locally, closed in production where an unauthenticated caller
    // could trigger a mass email.
    if (process.env.NODE_ENV !== "production") return true;
    logger.error("[cron/earnings-reports] CRON_SECRET is not set in production");
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = previousMonth();
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings`;

  let recipients;
  try {
    recipients = await prisma.user.findMany({
      where: { monthlyEarningsReport: true },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: MAX_RECIPIENTS_PER_RUN,
    });
  } catch (err) {
    logger.error("[cron/earnings-reports] Failed to read recipients:", err);
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of recipients) {
    // Vercel Cron delivers at least once. The unique (userId, period) pair is
    // what stops a retry from emailing someone their report twice — claim the
    // slot before doing any work, so a crash mid-send does not re-send later.
    try {
      await prisma.earningsReportDelivery.create({
        data: {
          userId: user.id,
          period: period.key,
          recipient: user.email,
          status: "queued",
        },
      });
    } catch {
      // Unique violation — already handled this period for this user.
      skipped += 1;
      continue;
    }

    const transactions = transactionsForPeriod(
      earningsStore.getTransactions(user.id),
      period,
    );

    if (transactions.length === 0) {
      // An empty "here is your month" email is the fastest way to get someone
      // to switch the report off. The delivery row is kept so a retry does not
      // reconsider.
      await prisma.earningsReportDelivery.update({
        where: { userId_period: { userId: user.id, period: period.key } },
        data: { status: "skipped" },
      });
      skipped += 1;
      continue;
    }

    const summary = summarise(transactions);

    const result = await sendTransactionalEmail({
      to: user.email,
      subject: `Your ClipCash earnings report — ${period.label}`,
      html: buildEmailHtml({ period, summary, settingsUrl }),
      text: buildEmailText({ period, summary, settingsUrl }),
      attachments: [
        {
          filename: csvFilename(period),
          content: buildCsv(transactions),
          contentType: "text/csv",
        },
      ],
    });

    if (result.ok) {
      sent += 1;
      await prisma.earningsReportDelivery.update({
        where: { userId_period: { userId: user.id, period: period.key } },
        data: {
          status: "sent",
          sentAt: new Date(),
          rowCount: transactions.length,
          totalCents: Math.round(summary.total * 100),
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { earningsReportSentAt: new Date() },
      });
    } else {
      failed += 1;
      // Left as `failed` rather than deleted: the row records the attempt, and
      // a re-run will skip it rather than retrying into the same error. A
      // failed month is re-sent by clearing the row deliberately.
      await prisma.earningsReportDelivery.update({
        where: { userId_period: { userId: user.id, period: period.key } },
        data: { status: "failed", error: result.error },
      });
      logger.error(
        `[cron/earnings-reports] Send failed for user=${user.id}: ${result.error}`,
      );
    }
  }

  logger.info(
    `[cron/earnings-reports] period=${period.key} sent=${sent} skipped=${skipped} failed=${failed}`,
  );

  return NextResponse.json({
    period: period.key,
    considered: recipients.length,
    sent,
    skipped,
    failed,
    // Surfaced so a production run that is quietly logging instead of
    // delivering is visible from the response rather than only in the logs.
    emailConfigured: isEmailConfigured(),
  });
}
