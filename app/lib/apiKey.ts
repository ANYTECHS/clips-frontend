import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

export interface GeneratedApiKey {
  key: string;
  keyPrefix: string;
  keyHash: string;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: {
    id: string;
    userId: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt?: Date | null;
    revokedAt?: Date | null;
    active: boolean;
    user?: {
      id: string;
      email: string;
      name?: string | null;
      plan: string;
    };
  };
  error?: "missing_key" | "invalid_format" | "not_found" | "inactive" | "expired" | "revoked";
}

export interface ApiKeyRouteContext {
  apiKey: NonNullable<ApiKeyValidationResult["apiKey"]>;
}

/**
 * Computes a SHA-256 hash of the given raw API key string.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key.trim()).digest("hex");
}

/**
 * Generates a cryptographically secure random API key with a prefix and its SHA-256 hash.
 * The raw key should only be returned to the creator once and never stored in plaintext.
 */
export function generateApiKey(prefix = "ck_live"): GeneratedApiKey {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const key = `${prefix}_${randomBytes}`;
  const keyPrefix = key.slice(0, 16);
  const keyHash = hashApiKey(key);

  return { key, keyPrefix, keyHash };
}

/**
 * Validates a raw API key against stored key hashes.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
  if (!rawKey || typeof rawKey !== "string") {
    return { valid: false, error: "missing_key" };
  }

  const trimmed = rawKey.trim();
  if (!trimmed.startsWith("ck_") && !trimmed.startsWith("ak_")) {
    return { valid: false, error: "invalid_format" };
  }

  const keyHash = hashApiKey(trimmed);

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
          },
        },
      },
    });

    if (!apiKey) {
      return { valid: false, error: "not_found" };
    }

    if (!apiKey.active) {
      return { valid: false, error: "inactive" };
    }

    if (apiKey.revokedAt) {
      return { valid: false, error: "revoked" };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false, error: "expired" };
    }

    // Asynchronously record lastUsedAt without blocking the request
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        logger.warn("[ApiKey] Failed to update lastUsedAt:", err);
      });

    return { valid: true, apiKey };
  } catch (error) {
    logger.error("[ApiKey] Error validating API key:", error);
    return { valid: false, error: "not_found" };
  }
}

/**
 * Creates and persists a new API key record with its SHA-256 hash.
 * Returns the raw secret key exactly once.
 */
export async function createApiKeyRecord({
  userId,
  name,
  scopes = ["read", "write"],
  expiresAt,
}: {
  userId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date | null;
}) {
  const { key, keyPrefix, keyHash } = generateApiKey();

  const record = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt: expiresAt ?? null,
      active: true,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      expiresAt: true,
      active: true,
      createdAt: true,
    },
  });

  return {
    apiKey: record,
    rawKey: key, // Returned ONCE upon creation
  };
}

/**
 * Revokes an existing API key.
 */
export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.apiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: {
        active: false,
        revokedAt: new Date(),
      },
    });
    return result.count > 0;
  } catch (error) {
    logger.error("[ApiKey] Error revoking API key:", error);
    return false;
  }
}

/**
 * Verifies if an API key's scopes satisfy the required permission scope.
 */
export function checkApiKeyScope(scopes: string[], requiredScope: string): boolean {
  if (!scopes || !Array.isArray(scopes)) return false;
  const action = requiredScope.split(":").at(-1);
  return (
    scopes.includes(requiredScope) ||
    (action !== requiredScope && scopes.includes(action)) ||
    scopes.includes("*") ||
    scopes.includes("admin")
  );
}

export function getApiKeyQuotaConfig() {
  const limit = Number.parseInt(process.env.API_KEY_REQUEST_QUOTA ?? "1000", 10);
  const windowMs = Number.parseInt(process.env.API_KEY_QUOTA_WINDOW_MS ?? "3600000", 10);

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 1000,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 3_600_000,
  };
}

export function getApiKeyQuotaWindow(now = Date.now()) {
  const { windowMs } = getApiKeyQuotaConfig();
  const startAt = Math.floor(now / windowMs) * windowMs;
  return { startAt, endsAt: startAt + windowMs };
}

function getRequestKey(request: NextRequest): string | null {
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) return apiKeyHeader.trim();

  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token, ...rest] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token && rest.length === 0 ? token.trim() : null;
}

function recordApiKeyUsage(
  apiKeyId: string,
  request: NextRequest,
  statusCode: number,
  startedAt: number
) {
  void prisma.apiUsage
    .create({
      data: {
        apiKeyId,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        statusCode,
        responseTime: Date.now() - startedAt,
      },
    })
    .catch((error) => {
      logger.warn("[ApiKey] Failed to record API usage:", error);
    });
}

/** Wraps a route handler with API-key scope checks, quota enforcement, and usage logging. */
export function requireScope(scope: string) {
  return function <Context extends object = Record<string, never>>(
    handler: (
      request: NextRequest,
      context: Context & ApiKeyRouteContext
    ) => Response | Promise<Response>
  ) {
    return async (request: NextRequest, context?: Context): Promise<Response> => {
      const startedAt = Date.now();
      const rawKey = getRequestKey(request);

      if (!rawKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const validation = await validateApiKey(rawKey);
      if (!validation.valid || !validation.apiKey) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }

      const { apiKey } = validation;
      const quota = getApiKeyQuotaConfig();
      const quotaWindow = getApiKeyQuotaWindow(startedAt);
      const rateLimited = await applyRateLimit(request, {
        limit: quota.limit,
        windowMs: Math.max(1, quotaWindow.endsAt - Date.now()),
        key: `api-key:${apiKey.id}`,
      });
      if (rateLimited) {
        recordApiKeyUsage(apiKey.id, request, 429, startedAt);
        return rateLimited;
      }

      if (!checkApiKeyScope(apiKey.scopes, scope)) {
        recordApiKeyUsage(apiKey.id, request, 403, startedAt);
        return NextResponse.json({ error: "Insufficient scope", required: scope }, { status: 403 });
      }

      try {
        const response = await handler(request, {
          ...(context ?? ({} as Context)),
          apiKey,
        });
        recordApiKeyUsage(apiKey.id, request, response.status, startedAt);
        return response;
      } catch (error) {
        recordApiKeyUsage(apiKey.id, request, 500, startedAt);
        throw error;
      }
    };
  };
}
