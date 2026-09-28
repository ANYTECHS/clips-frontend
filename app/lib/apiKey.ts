import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";

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
  return scopes.includes(requiredScope) || scopes.includes("*") || scopes.includes("admin");
}
