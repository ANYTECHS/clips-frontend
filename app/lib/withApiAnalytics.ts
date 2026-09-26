import { NextRequest, NextResponse } from "next/server";
import { recordApiRequest } from "@/app/lib/apiAnalytics";

type RouteHandler<Ctx> = (request: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js route handler so every call is recorded for the API
 * analytics dashboard (endpoint, user, and performance breakdowns).
 *
 * @param route - Canonical route path, e.g. "/api/clips".
 * @param getUserId - Optional extractor called with the same args as the
 *   handler; return the authenticated user id when known.
 */
export function withApiAnalytics<Ctx = unknown>(
  route: string,
  handler: RouteHandler<Ctx>,
  getUserId?: (request: NextRequest, ctx: Ctx) => string | undefined | Promise<string | undefined>
): RouteHandler<Ctx> {
  return async (request: NextRequest, ctx: Ctx) => {
    const start = Date.now();
    let statusCode = 500;
    try {
      const response = await handler(request, ctx);
      statusCode = response.status;
      return response;
    } finally {
      recordApiRequest({
        route,
        method: request.method,
        statusCode,
        durationMs: Date.now() - start,
        userId: await getUserId?.(request, ctx),
        timestamp: Date.now(),
      });
    }
  };
}
