/**
 * app/lib/apiMiddleware.ts
 *
 * Centralised API middleware factory — Issues #893 and #895.
 *
 * Addresses:
 *   #893 — Authentication middleware (session validation, role-based access)
 *   #895 — Error handling middleware (global error classification, formatted
 *           error responses, error logging)
 *
 * Usage:
 *   import { withApiMiddleware } from "@/app/lib/apiMiddleware";
 *
 *   export const GET = withApiMiddleware(
 *     async (req, ctx) => {
 *       const { userId } = ctx.auth;  // always present — 401 returned if not
 *       return NextResponse.json({ ok: true });
 *     },
 *     { requireAuth: true }
 *   );
 *
 *   // Role-gated endpoint
 *   export const DELETE = withApiMiddleware(handler, {
 *     requireAuth: true,
 *     requiredRoles: ["admin"],
 *   });
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { errorCodeForStatus, normalizeErrorCode } from "@/app/api/errorCodes";
import type { ErrorCode } from "@/app/api/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthContext {
  /** Authenticated user id. Present when `requireAuth: true`. */
  userId: string;
  /** Roles assigned to the session user (populated from JWT claims). */
  roles: string[];
}

export interface ApiContext {
  auth: AuthContext;
  /** Raw NextRequest forwarded from the route handler. */
  request: NextRequest;
}

export type ApiHandler<TParams = unknown> = (
  request: NextRequest,
  ctx: ApiContext,
  params?: TParams
) => Promise<NextResponse> | NextResponse;

export interface MiddlewareOptions {
  /**
   * When true the middleware validates the session and rejects with 401 if no
   * authenticated user is found.  Defaults to `true`.
   */
  requireAuth?: boolean;
  /**
   * Optional list of roles required to access the handler.  If the session
   * user does not hold at least one of these roles the middleware returns 403.
   */
  requiredRoles?: string[];
  /** Maximum time for authentication and route execution; false disables it. */
  timeoutMs?: number | false;
}

export const DEFAULT_API_TIMEOUT_MS = 10_000;

function getTimeoutMs(timeoutMs: number | false | undefined): number | false {
  if (timeoutMs === false) return false;
  if (timeoutMs !== undefined) return timeoutMs;

  const configured = Number(process.env.API_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_API_TIMEOUT_MS;
}

// ─── Error classification ─────────────────────────────────────────────────────

export type ApiErrorCode = ErrorCode;

export interface FormattedError {
  data: null;
  error: string;
  code: ErrorCode;
  meta: { timestamp: string };
  /** Human-friendly detail; omitted in production to avoid leaking internals. */
  detail?: string;
}

/** Well-known error class wrappable by handlers to signal an API error. */
export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: ApiErrorCode = "INTERNAL_ERROR",
    public readonly detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Maps an unknown thrown value to a structured error response. */
export function classifyError(err: unknown): { status: number; body: FormattedError } {
  const isProd = process.env.NODE_ENV === "production";

  if (err instanceof ApiError) {
    const code = normalizeErrorCode(err.code);
    return {
      status: err.statusCode,
      body: {
        data: null,
        error: err.message,
        code,
        meta: { timestamp: new Date().toISOString() },
        ...(err.detail && !isProd ? { detail: err.detail } : {}),
      },
    };
  }

  if (err instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        data: null,
        error: "Invalid JSON",
        code: "INVALID_INPUT",
        meta: { timestamp: new Date().toISOString() },
      },
    };
  }

  const message = err instanceof Error ? err.message : "Unexpected error";

  // Surface known sentinel messages that route handlers already throw.
  if (message === "RATE_LIMIT_EXCEEDED") {
    return {
      status: 429,
      body: {
        data: null,
        error: "Too many requests",
        code: "RATE_LIMITED",
        meta: { timestamp: new Date().toISOString() },
      },
    };
  }

  logger.error("[apiMiddleware] Unhandled route error:", err);

  return {
    status: 500,
    body: {
      data: null,
      error: "Internal server error",
      code: errorCodeForStatus(500),
      meta: { timestamp: new Date().toISOString() },
      ...(!isProd ? { detail: message } : {}),
    },
  };
}

// ─── Session helpers ──────────────────────────────────────────────────────────

interface SessionUser {
  id?: string;
  roles?: string[];
}

async function resolveAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) return null;
  return {
    userId: user.id,
    roles: user.roles ?? [],
  };
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Wraps a route handler with:
 *  1. Session validation + 401 guard (configurable)
 *  2. Role-based access control + 403 guard (configurable)
 *  3. Centralised error catching, classification, and response formatting
 *  4. Error logging via the shared logger
 *
 * @param handler The actual route logic.
 * @param options Middleware configuration.
 */
export function withApiMiddleware<TParams = unknown>(
  handler: ApiHandler<TParams>,
  options: MiddlewareOptions = {}
): (request: NextRequest, routeCtx?: { params?: Promise<TParams> }) => Promise<NextResponse> {
  const {
    requireAuth: shouldRequireAuth = true,
    requiredRoles = [],
    timeoutMs: configuredTimeoutMs,
  } = options;
  const timeoutMs = getTimeoutMs(configuredTimeoutMs);

  return async (
    request: NextRequest,
    routeCtx?: { params?: Promise<TParams> }
  ): Promise<NextResponse> => {
    const execute = async (): Promise<NextResponse> => {
      // ── 1. Authentication ─────────────────────────────────────────────────
      let authCtx: AuthContext = { userId: "", roles: [] };

      if (shouldRequireAuth) {
        const resolved = await resolveAuthContext();
        if (!resolved) {
          const body = { data: null, error: "Unauthorized", code: "UNAUTHORIZED" as const, meta: { timestamp: new Date().toISOString() } };
          return NextResponse.json(body, { status: 401 });
        }
        authCtx = resolved;
      }

      // ── 2. Role-based access control ──────────────────────────────────────
      if (requiredRoles.length > 0) {
        const hasRole = requiredRoles.some((r) => authCtx.roles.includes(r));
        if (!hasRole) {
          const body = { data: null, error: "Forbidden", code: "FORBIDDEN" as const, meta: { timestamp: new Date().toISOString() } };
          return NextResponse.json(body, { status: 403 });
        }
      }

      // ── 3. Delegate to handler ────────────────────────────────────────────
      const ctx: ApiContext = { auth: authCtx, request };
      const params = routeCtx?.params ? await routeCtx.params : undefined;
      return await handler(request, ctx, params as TParams | undefined);
    };

    try {
      if (timeoutMs === false) return await execute();

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new ApiError("Request timed out", 504, "TIMEOUT"));
        }, timeoutMs);
      });

      try {
        return await Promise.race([execute(), timeout]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    } catch (err) {
      // ── 4. Centralised error handling ─────────────────────────────────────
      const { status, body } = classifyError(err);
      return NextResponse.json(body, {
        status,
        headers: body.code === "TIMEOUT" ? { "Retry-After": "1" } : undefined,
      });
    }
  };
}

/**
 * Standalone error response helper for use outside the middleware wrapper,
 * e.g. in routes that can't adopt withApiMiddleware yet.
 */
export function errorResponse(
  err: unknown,
  fallbackMessage = "Internal server error"
): NextResponse {
  const { status, body } = classifyError(err);
  if (body.code === "INTERNAL_ERROR" && body.error === "Internal server error") {
    body.error = fallbackMessage;
  }
  return NextResponse.json(body, {
    status,
    headers: body.code === "TIMEOUT" ? { "Retry-After": "1" } : undefined,
  });
}
