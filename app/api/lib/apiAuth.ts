import { NextRequest } from "next/server";

import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

export interface ApiAuthResult {
  success: boolean;
  apiKey?: any;
  error?: string;
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return { success: false, error: "Missing authorization header" };
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return { success: false, error: "Invalid authorization format" };
  }

  if (!token.startsWith("ck_")) {
    return { success: false, error: "Invalid API key format" };
  }

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true },
    });

    if (!apiKey) {
      return { success: false, error: "Invalid API key" };
    }

    if (!apiKey.active) {
      return { success: false, error: "API key is inactive" };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { success: false, error: "API key has expired" };
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { success: true, apiKey };
  } catch (error) {
    logger.error("Error authenticating API key:", error);
    return { success: false, error: "Authentication failed" };
  }
}

export function checkScope(apiKey: any, requiredScope: string): boolean {
  return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes("*");
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
