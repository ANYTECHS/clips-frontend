/**
 * POST /api/earnings/schedule-report
 *
 * Enables or disables the monthly earnings report email (Issue #820).
 *
 * Opt-in, not opt-out: this mail carries a full transaction export, so a
 * creator has to ask for their financial records to be posted to their inbox
 * every month rather than having to notice and switch it off.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { prisma } from "@/app/lib/prisma";
import { scheduleReportBodySchema } from "../../schemas/index";
import type { ApiResponse } from "../../types";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = scheduleReportBodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { enabled } = parsed.data;

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { monthlyEarningsReport: enabled },
      select: { email: true, monthlyEarningsReport: true },
    });

    const body: ApiResponse<{ enabled: boolean; deliveryEmail: string }> = {
      data: { enabled: user.monthlyEarningsReport, deliveryEmail: user.email },
      error: null,
    };

    return NextResponse.json(body);
  } catch {
    // A missing row is the realistic failure here — a session whose user was
    // deleted. Anything else is a database problem the caller cannot act on.
    return NextResponse.json({ error: "Could not update preference" }, { status: 500 });
  }
}

/** GET /api/earnings/schedule-report — current state, for the settings toggle. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, monthlyEarningsReport: true, earningsReportSentAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: ApiResponse<{
      enabled: boolean;
      deliveryEmail: string;
      lastSentAt: string | null;
    }> = {
      data: {
        enabled: user.monthlyEarningsReport,
        deliveryEmail: user.email,
        lastSentAt: user.earningsReportSentAt?.toISOString() ?? null,
      },
      error: null,
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Could not read preference" }, { status: 500 });
  }
}
