import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { createAuditEvent } from "@/app/lib/auditLog";
import { geolocateIp } from "@/app/lib/geoip";
import { checkLoginAnomaly } from "@/app/lib/loginSecurity";

export interface SessionSecurityConfig {
  /** Maximum lifetime of a session in seconds (default: 30 days) */
  sessionMaxAgeSeconds: number;
  /** Inactivity timeout in seconds (default: 24 hours) */
  inactivityTimeoutSeconds: number;
  /** Maximum number of active concurrent sessions per user (default: 5) */
  maxConcurrentSessions: number;
  /** Whether secure cookies should be enforced (true in production) */
  useSecureCookies: boolean;
  /** Cookie domain if customized */
  cookieDomain?: string;
}

export function getSessionSecurityConfig(): SessionSecurityConfig {
  const isProd = process.env.NODE_ENV === "production";
  return {
    sessionMaxAgeSeconds: parseInt(
      process.env.SESSION_MAX_AGE || `${30 * 24 * 60 * 60}`,
      10
    ),
    inactivityTimeoutSeconds: parseInt(
      process.env.SESSION_INACTIVITY_TIMEOUT || `${24 * 60 * 60}`,
      10
    ),
    maxConcurrentSessions: parseInt(
      process.env.MAX_CONCURRENT_SESSIONS || "5",
      10
    ),
    useSecureCookies: isProd,
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  };
}

/**
 * Returns cookie configuration for Auth.js / NextAuth adhering to security hardening guidelines:
 * - HttpOnly prevents XSS theft
 * - Secure ensures transmission strictly over HTTPS in production
 * - SameSite=Lax prevents CSRF while permitting top-level navigations
 */
export function getSecureCookieConfig(useSecure = process.env.NODE_ENV === "production") {
  const cookiePrefix = useSecure ? "__Secure-" : "";
  const hostPrefix = useSecure ? "__Host-" : "";

  return {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
    csrfToken: {
      name: `${hostPrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
  };
}

function parseClientDetails(req?: NextRequest): { ipAddress: string; userAgent: string; cfCountry: string | null } {
  if (!req) {
    return { ipAddress: "unknown", userAgent: "unknown", cfCountry: null };
  }
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const cfCountry = req.headers.get("cf-ipcountry");
  return { ipAddress, userAgent, cfCountry };
}

/**
 * Creates and registers a new tracked session in persistent storage.
 * Enforces concurrent session limits: if the active count exceeds limit,
 * the oldest session is automatically revoked.
 *
 * After creating the session the function kicks off a fire-and-forget
 * geolocation + anomaly check that sends an alert email when a suspicious
 * login is detected (new country or impossible travel). The check never
 * blocks the sign-in flow.
 *
 * @param userId     - The authenticated user's DB id.
 * @param req        - Incoming NextRequest, used to extract IP / user-agent.
 * @param userEmail  - User's email address, passed to the alert mailer.
 */
export async function createTrackedSession(
  userId: string,
  req?: NextRequest,
  userEmail?: string,
) {
  const config = getSessionSecurityConfig();
  const { ipAddress, userAgent, cfCountry } = parseClientDetails(req);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionMaxAgeSeconds * 1000);

  // 1. Enforce concurrent session limit
  const activeSessions = await prisma.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "asc" },
  });

  if (activeSessions.length >= config.maxConcurrentSessions) {
    // Revoke oldest sessions to make room
    const excessCount = activeSessions.length - config.maxConcurrentSessions + 1;
    const toRevoke = activeSessions.slice(0, excessCount);

    for (const session of toRevoke) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });

      // Audit event for concurrency eviction
      await createAuditEvent({
        actorId: userId,
        action: "session.concurrency_limit_exceeded",
        resource: "session",
        resourceId: session.id,
        status: "success",
        metadata: {
          evictedSessionId: session.id,
          reason: `Concurrent session limit (${config.maxConcurrentSessions}) reached`,
        },
      });
    }
  }

  // 2. Resolve geolocation for the connecting IP (best-effort, non-blocking)
  const geo = await geolocateIp(ipAddress, cfCountry).catch((err) => {
    logger.warn("[SessionSecurity] Geolocation lookup failed", { ipAddress, err });
    return null;
  });

  // 3. Generate cryptographically random session token
  const sessionToken = `sess_${crypto.randomBytes(32).toString("hex")}`;

  const newSession = await prisma.userSession.create({
    data: {
      userId,
      sessionToken,
      ipAddress,
      userAgent,
      lastActivityAt: now,
      expiresAt,
      // Geo fields — null when lookup failed or IP is private
      country: geo?.country ?? null,
      city: geo?.city ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    },
  });

  // 4. Audit event for new session
  await createAuditEvent({
    actorId: userId,
    action: "session.created",
    resource: "session",
    resourceId: newSession.id,
    ipAddress,
    userAgent,
    status: "success",
    metadata: geo
      ? { country: geo.country, city: geo.city }
      : undefined,
  });

  // 5. Suspicious-login anomaly check — fire-and-forget, never blocks sign-in
  if (userEmail) {
    checkLoginAnomaly({
      userId,
      userEmail,
      newSessionId: newSession.id,
      newGeo: geo,
      ipAddress,
      userAgent,
    }).catch((err) => {
      logger.error("[SessionSecurity] Anomaly check failed", { userId, err });
    });
  }

  return newSession;
}

/**
 * Validates a tracked session checking for expiration, revocation, and inactivity timeout.
 * Automatically updates lastActivityAt if valid.
 */
export async function validateTrackedSession(sessionToken: string): Promise<{
  valid: boolean;
  session?: any;
  reason?: "not_found" | "revoked" | "expired" | "inactivity_timeout";
}> {
  if (!sessionToken) return { valid: false, reason: "not_found" };

  try {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: { id: true, email: true, name: true, plan: true },
        },
      },
    });

    if (!session) {
      return { valid: false, reason: "not_found" };
    }

    if (session.revokedAt) {
      return { valid: false, reason: "revoked" };
    }

    const now = Date.now();
    if (new Date(session.expiresAt).getTime() < now) {
      return { valid: false, reason: "expired" };
    }

    // Check inactivity timeout
    const config = getSessionSecurityConfig();
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (now - lastActivity > config.inactivityTimeoutSeconds * 1000) {
      // Inactivity timeout reached: revoke session
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await createAuditEvent({
        actorId: session.userId,
        action: "session.inactivity_timeout",
        resource: "session",
        resourceId: session.id,
        status: "success",
      });

      return { valid: false, reason: "inactivity_timeout" };
    }

    // Update last activity asynchronously
    prisma.userSession
      .update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      })
      .catch((err) => {
        logger.warn("[SessionSecurity] Failed to update lastActivityAt:", err);
      });

    return { valid: true, session };
  } catch (error) {
    logger.error("[SessionSecurity] Error validating session:", error);
    return { valid: false, reason: "not_found" };
  }
}

/**
 * Rotates an active session token: marks old token revoked and creates a fresh replacement.
 */
export async function rotateSession(oldSessionToken: string, userId: string, req?: NextRequest) {
  const now = new Date();
  const { ipAddress, userAgent } = parseClientDetails(req);
  const config = getSessionSecurityConfig();
  const expiresAt = new Date(now.getTime() + config.sessionMaxAgeSeconds * 1000);

  // 1. Invalidate old session
  await prisma.userSession.updateMany({
    where: { sessionToken: oldSessionToken, userId },
    data: { revokedAt: now },
  });

  // 2. Issue new session token
  const newSessionToken = `sess_${crypto.randomBytes(32).toString("hex")}`;

  const newSession = await prisma.userSession.create({
    data: {
      userId,
      sessionToken: newSessionToken,
      ipAddress,
      userAgent,
      lastActivityAt: now,
      expiresAt,
    },
  });

  await createAuditEvent({
    actorId: userId,
    action: "session.rotated",
    resource: "session",
    resourceId: newSession.id,
    ipAddress,
    userAgent,
    status: "success",
  });

  return newSession;
}

/**
 * Revokes a specific session token.
 */
export async function revokeSession(sessionToken: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.userSession.updateMany({
      where: { sessionToken, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count > 0) {
      await createAuditEvent({
        actorId: userId,
        action: "session.revoked",
        resource: "session",
        status: "success",
      });
      return true;
    }
    return false;
  } catch (error) {
    logger.error("[SessionSecurity] Error revoking session:", error);
    return false;
  }
}

/**
 * Revokes all sessions belonging to a user (e.g. on password reset or logout-all).
 */
export async function revokeAllUserSessions(userId: string, exceptSessionToken?: string): Promise<number> {
  try {
    const where: any = { userId, revokedAt: null };
    if (exceptSessionToken) {
      where.sessionToken = { not: exceptSessionToken };
    }

    const result = await prisma.userSession.updateMany({
      where,
      data: { revokedAt: new Date() },
    });

    await createAuditEvent({
      actorId: userId,
      action: "session.revoke_all",
      resource: "session",
      status: "success",
      metadata: { revokedCount: result.count },
    });

    return result.count;
  } catch (error) {
    logger.error("[SessionSecurity] Error revoking all sessions:", error);
    return 0;
  }
}

/**
 * Lists all active non-revoked sessions for a user.
 * Returns geo location, suspicious flag, and step-up verification state
 * so the sessions dashboard can surface anomalous sessions to the user.
 */
export async function getUserActiveSessions(userId: string, currentSessionToken?: string) {
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: "desc" },
    select: {
      id: true,
      sessionToken: true,
      ipAddress: true,
      userAgent: true,
      country: true,
      city: true,
      suspicious: true,
      stepUpVerified: true,
      lastActivityAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    country: s.country,
    city: s.city,
    suspicious: s.suspicious,
    stepUpVerified: s.stepUpVerified,
    lastActivityAt: s.lastActivityAt,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: currentSessionToken ? s.sessionToken === currentSessionToken : false,
  }));
}
