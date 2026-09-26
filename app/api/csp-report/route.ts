/**
 * POST /api/csp-report
 *
 * Browser CSP violation reports land here (via the `report-uri` directive).
 * Unauthenticated by design — the browser posts reports without cookies.
 * Rate-limited to reduce noise from malicious or buggy clients.
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { logger } from "@/app/lib/logger";

export const dynamic = "force-dynamic";

type CspReportBody = {
  "csp-report"?: Record<string, unknown>;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, {
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  let body: CspReportBody;
  try {
    body = (await request.json()) as CspReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const report = body["csp-report"] ?? body;

  logger.warn("[csp-report] Content-Security-Policy violation", {
    documentUri: report["document-uri"] ?? report["documentURI"],
    violatedDirective:
      report["violated-directive"] ?? report["violatedDirective"],
    effectiveDirective:
      report["effective-directive"] ?? report["effectiveDirective"],
    blockedUri: report["blocked-uri"] ?? report["blockedURI"],
    originalPolicy: report["original-policy"] ?? report["originalPolicy"],
    sourceFile: report["source-file"] ?? report["sourceFile"],
    lineNumber: report["line-number"] ?? report["lineNumber"],
    statusCode: report["status-code"] ?? report["statusCode"],
    disposition: report["disposition"],
  });

  // Browsers ignore the response body; 204 keeps the handler cheap.
  return new NextResponse(null, { status: 204 });
}
