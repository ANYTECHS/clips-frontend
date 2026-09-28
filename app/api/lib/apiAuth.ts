import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { validateApiKey, checkApiKeyScope } from "@/app/lib/apiKey";
import { verifyApiJwt, ApiJwtPayload } from "@/app/lib/jwt";
import { auth } from "@/app/lib/auth";
import { createAuditEvent } from "@/app/lib/auditLog";

export interface ApiAuthResult {
  success: boolean;
  apiKey?: any;
  user?: any;
  jwtPayload?: ApiJwtPayload;
  authType?: "api_key" | "jwt" | "session";
  error?: string;
  statusCode?: number;
}

export interface AuthFailureEvent {
  type:
    | "missing_credentials"
    | "invalid_api_key"
    | "expired_api_key"
    | "revoked_api_key"
    | "invalid_jwt"
    | "expired_jwt"
    | "insufficient_scopes"
    | "rate_limited";
  path: string;
  method?: string;
  ip?: string;
  keyPrefix?: string;
  reason?: string;
}

/**
 * Logs authentication failure events for security monitoring and audit logging.
 * Never logs credentials, passwords, raw API keys, or raw JWTs.
 */
export function logAuthFailure(event: AuthFailureEvent) {
  logger.warn(`[Security Alert: Auth Failure] type=${event.type} path=${event.path} ip=${event.ip ?? "unknown"} reason=${event.reason ?? "unspecified"}`);

  // Create audit event for security monitoring
  createAuditEvent({
    actorId: event.keyPrefix ?? "anonymous",
    actorType: event.keyPrefix ? "api_key" : "system",
    action: `auth.failure.${event.type}`,
    resource: "api",
    resourceId: event.path,
    ipAddress: event.ip,
    status: "failure",
    metadata: {
      type: event.type,
      path: event.path,
      method: event.method,
      reason: event.reason,
    },
  }).catch((err) => {
    logger.warn("[AuthFailureMonitoring] Could not persist audit record:", err);
  });
}

/**
 * Authenticates an incoming API key from the Authorization header or X-API-Key header.
 * Uses SHA-256 hashed lookup — plaintext keys are never stored or matched.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const path = req.nextUrl?.pathname || req.url;

  // Extract key from Authorization: Bearer <key> or X-API-Key: <key>
  let token: string | null = null;
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  if (xApiKey) {
    token = xApiKey.trim();
  } else if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1].trim();
    }
  }

  if (!token) {
    return { success: false, error: "Missing API key credentials", statusCode: 401 };
  }

  const validation = await validateApiKey(token);

  if (!validation.valid || !validation.apiKey) {
    const errorType =
      validation.error === "expired"
        ? "expired_api_key"
        : validation.error === "revoked"
        ? "revoked_api_key"
        : "invalid_api_key";

    logAuthFailure({
      type: errorType,
      path,
      method: req.method,
      ip,
      keyPrefix: token.slice(0, 16),
      reason: validation.error,
    });

    const errorMsg =
      validation.error === "expired"
        ? "API key has expired"
        : validation.error === "revoked"
        ? "API key has been revoked"
        : validation.error === "inactive"
        ? "API key is inactive"
        : "Invalid API key";

    return { success: false, error: errorMsg, statusCode: 401 };
  }

  return {
    success: true,
    apiKey: validation.apiKey,
    user: validation.apiKey.user,
    authType: "api_key",
  };
}

/**
 * Authenticates an incoming request using either API key, JWT token, or user session.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  options: { requiredScope?: string; allowSession?: boolean } = {}
): Promise<ApiAuthResult> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const path = req.nextUrl?.pathname || req.url;
  const allowSession = options.allowSession !== false;

  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  // 1. Direct API Key via X-API-Key header
  if (xApiKey) {
    const keyResult = await authenticateApiKey(req);
    if (!keyResult.success) return keyResult;

    if (options.requiredScope && !checkApiKeyScope(keyResult.apiKey.scopes, options.requiredScope)) {
      logAuthFailure({
        type: "insufficient_scopes",
        path,
        method: req.method,
        ip,
        reason: `Required scope: ${options.requiredScope}`,
      });
      return { success: false, error: "Insufficient permissions", statusCode: 403 };
    }

    return keyResult;
  }

  // 2. Bearer token (could be API Key `ck_...` or JWT)
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      const token = parts[1].trim();

      // If token starts with ck_ or ak_, treat as API key
      if (token.startsWith("ck_") || token.startsWith("ak_")) {
        const keyResult = await authenticateApiKey(req);
        if (!keyResult.success) return keyResult;

        if (options.requiredScope && !checkApiKeyScope(keyResult.apiKey.scopes, options.requiredScope)) {
          logAuthFailure({
            type: "insufficient_scopes",
            path,
            method: req.method,
            ip,
            reason: `Required scope: ${options.requiredScope}`,
          });
          return { success: false, error: "Insufficient permissions", statusCode: 403 };
        }

        return keyResult;
      }

      // Otherwise evaluate as JWT token
      const jwtResult = verifyApiJwt(token);
      if (!jwtResult.valid || !jwtResult.payload) {
        const errorType = jwtResult.error === "expired" ? "expired_jwt" : "invalid_jwt";
        logAuthFailure({
          type: errorType,
          path,
          method: req.method,
          ip,
          reason: jwtResult.error,
        });

        const errorMsg = jwtResult.error === "expired" ? "JWT token has expired" : "Invalid JWT token";
        return { success: false, error: errorMsg, statusCode: 401 };
      }

      // Check JWT scopes if required
      if (
        options.requiredScope &&
        jwtResult.payload.scopes &&
        !checkApiKeyScope(jwtResult.payload.scopes, options.requiredScope)
      ) {
        logAuthFailure({
          type: "insufficient_scopes",
          path,
          method: req.method,
          ip,
          reason: `Required scope: ${options.requiredScope}`,
        });
        return { success: false, error: "Insufficient permissions", statusCode: 403 };
      }

      return {
        success: true,
        jwtPayload: jwtResult.payload,
        user: { id: jwtResult.payload.sub, email: jwtResult.payload.email },
        authType: "jwt",
      };
    }
  }

  // 3. Fallback to browser session if enabled
  if (allowSession) {
    try {
      const session = await auth();
      if (session?.user?.id) {
        return {
          success: true,
          user: session.user,
          authType: "session",
        };
      }
    } catch (err) {
      logger.warn("[ApiAuth] Session validation failed:", err);
    }
  }

  // 4. Missing all authentication credentials
  logAuthFailure({
    type: "missing_credentials",
    path,
    method: req.method,
    ip,
    reason: "No valid API key, JWT token, or active session found",
  });

  return { success: false, error: "Authentication required", statusCode: 401 };
}

/**
 * API route handler middleware wrapper that enforces authentication and permissions.
 */
export function withApiAuth(
  handler: (req: NextRequest, authContext: ApiAuthResult) => Promise<NextResponse>,
  options: { requiredScope?: string; allowSession?: boolean } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const authResult = await authenticateApiRequest(req, options);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.statusCode || 401 }
      );
    }

    return handler(req, authResult);
  };
}

export function checkScope(apiKeyOrScopes: any, requiredScope: string): boolean {
  if (Array.isArray(apiKeyOrScopes)) {
    return checkApiKeyScope(apiKeyOrScopes, requiredScope);
  }
  if (apiKeyOrScopes?.scopes) {
    return checkApiKeyScope(apiKeyOrScopes.scopes, requiredScope);
  }
  return false;
}

export async function logApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number
) {
  try {
    await prisma.apiUsage.create({
      data: {
        apiKeyId,
        endpoint,
        method,
        statusCode,
        responseTime,
      },
    });
  } catch (error) {
    logger.error("Error logging API usage:", error);
  }
}
