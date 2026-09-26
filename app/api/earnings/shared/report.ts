/**
 * app/api/earnings/shared/report.ts
 *
 * CSV generation and the branded HTML template for the monthly earnings
 * report email (Issue #820).
 *
 * Kept separate from the cron route so the formatting is testable without
 * standing up a request, and so the same report can later be produced
 * on-demand from the earnings page.
 */

import type { EarningTransaction } from "../types";

/** Columns in the exported CSV, in order. */
const CSV_COLUMNS = [
  "date",
  "description",
  "platform",
  "type",
  "status",
  "amount",
  "cryptoAmount",
  "cryptoCurrency",
  "taxId",
] as const;

export interface ReportPeriod {
  /** `YYYY-MM`. */
  key: string;
  /** e.g. "March 2026". */
  label: string;
  /** Inclusive `YYYY-MM-DD`. */
  start: string;
  /** Inclusive `YYYY-MM-DD`. */
  end: string;
}

/**
 * The month *before* `now` — the one a report sent on the 1st covers.
 *
 * Computed in UTC. A creator in UTC+13 running the job at their local
 * midnight would otherwise see the boundary land a day off, and a tax export
 * that silently drops or duplicates a day's transactions is worse than one
 * that is a few hours out of step with the local calendar.
 */
export function previousMonth(now: Date = new Date()): ReportPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based; this is the *current* month

  // Day 0 of the current month is the last day of the previous one.
  const lastDay = new Date(Date.UTC(year, month, 0));
  const firstDay = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), 1));

  const pad = (n: number) => String(n).padStart(2, "0");
  const key = `${firstDay.getUTCFullYear()}-${pad(firstDay.getUTCMonth() + 1)}`;

  return {
    key,
    label: firstDay.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    start: firstDay.toISOString().slice(0, 10),
    end: lastDay.toISOString().slice(0, 10),
  };
}

/** Transactions falling inside `period`, oldest first. */
export function transactionsForPeriod(
  transactions: readonly EarningTransaction[],
  period: ReportPeriod,
): EarningTransaction[] {
  return transactions
    .filter((tx) => {
      const day = tx.date.slice(0, 10);
      return day >= period.start && day <= period.end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Escapes one CSV cell.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a single quote: spreadsheet
 * software reads those as the start of a formula, so a transaction
 * description carrying one would execute when an accountant opens the file.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const raw = String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;

  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Builds the CSV attachment body. */
export function buildCsv(transactions: readonly EarningTransaction[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = transactions.map((tx) =>
    CSV_COLUMNS.map((col) => csvCell((tx as Record<string, unknown>)[col])).join(","),
  );

  // CRLF plus a UTF-8 BOM — Excel reads a plain LF file as one long row and
  // mangles non-ASCII descriptions without the BOM.
  return `﻿${[header, ...rows].join("\r\n")}\r\n`;
}

export interface ReportSummary {
  total: number;
  completed: number;
  pending: number;
  count: number;
  byPlatform: Array<{ platform: string; amount: number }>;
}

export function summarise(transactions: readonly EarningTransaction[]): ReportSummary {
  const sum = (txs: readonly EarningTransaction[]) =>
    txs.reduce((acc, tx) => acc + tx.amount, 0);

  const platforms = new Map<string, number>();
  for (const tx of transactions) {
    platforms.set(tx.platform, (platforms.get(tx.platform) ?? 0) + tx.amount);
  }

  return {
    total: sum(transactions),
    completed: sum(transactions.filter((tx) => tx.status === "completed")),
    pending: sum(transactions.filter((tx) => tx.status === "pending")),
    count: transactions.length,
    byPlatform: [...platforms.entries()]
      .map(([platform, amount]) => ({ platform, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Escapes text interpolated into the HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Branded HTML body for the report email.
 *
 * Table-based layout with inline styles, which is not how anyone would write a
 * page — but email clients strip `<style>` blocks and have no flexbox, so it
 * is how a mail that renders the same in Outlook and Gmail has to be built.
 */
export function buildEmailHtml(params: {
  period: ReportPeriod;
  summary: ReportSummary;
  settingsUrl: string;
}): string {
  const { period, summary, settingsUrl } = params;

  const platformRows = summary.byPlatform
    .map(
      ({ platform, amount }) => `
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:14px;">${escapeHtml(platform)}</td>
          <td style="padding:8px 0;color:#fafafa;font-size:14px;text-align:right;font-weight:600;">${money(amount)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#18181b;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;">
                <p style="margin:0 0 4px;color:#22c55e;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">ClipCash</p>
                <h1 style="margin:0;color:#fafafa;font-size:24px;font-weight:800;">Earnings report — ${escapeHtml(period.label)}</h1>
                <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">
                  ${summary.count} transaction${summary.count === 1 ? "" : "s"} from ${escapeHtml(period.start)} to ${escapeHtml(period.end)}.
                  The full export is attached as a CSV.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:12px;padding:20px;">
                  <tr>
                    <td style="color:#a1a1aa;font-size:13px;padding-bottom:4px;">Total earned</td>
                  </tr>
                  <tr>
                    <td style="color:#fafafa;font-size:32px;font-weight:800;padding-bottom:16px;">${money(summary.total)}</td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#a1a1aa;font-size:13px;">Completed</td>
                          <td style="color:#22c55e;font-size:13px;text-align:right;font-weight:600;">${money(summary.completed)}</td>
                        </tr>
                        <tr>
                          <td style="color:#a1a1aa;font-size:13px;padding-top:4px;">Pending</td>
                          <td style="color:#facc15;font-size:13px;text-align:right;font-weight:600;padding-top:4px;">${money(summary.pending)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${
              summary.byPlatform.length > 0
                ? `<tr>
              <td style="padding:24px 32px 0;">
                <p style="margin:0 0 8px;color:#fafafa;font-size:14px;font-weight:700;">By platform</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${platformRows}</table>
              </td>
            </tr>`
                : ""
            }

            <tr>
              <td style="padding:24px 32px 32px;">
                <p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">
                  This report is for your records. Figures are as recorded by ClipCash and are not tax advice.
                  <br />
                  You are receiving this because monthly reports are switched on.
                  <a href="${escapeHtml(settingsUrl)}" style="color:#22c55e;">Turn them off in Settings</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text alternative. Always sent — some clients refuse HTML outright. */
export function buildEmailText(params: {
  period: ReportPeriod;
  summary: ReportSummary;
  settingsUrl: string;
}): string {
  const { period, summary, settingsUrl } = params;

  const platforms = summary.byPlatform
    .map(({ platform, amount }) => `  ${platform}: ${money(amount)}`)
    .join("\n");

  return [
    `ClipCash earnings report — ${period.label}`,
    "",
    `${summary.count} transaction(s) from ${period.start} to ${period.end}.`,
    "",
    `Total earned:  ${money(summary.total)}`,
    `Completed:     ${money(summary.completed)}`,
    `Pending:       ${money(summary.pending)}`,
    "",
    platforms ? `By platform:\n${platforms}` : "",
    "",
    "The full export is attached as a CSV.",
    "",
    "This report is for your records and is not tax advice.",
    `Turn monthly reports off: ${settingsUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Filename for the attached CSV. */
export function csvFilename(period: ReportPeriod): string {
  return `clipcash-earnings-${period.key}.csv`;
}
