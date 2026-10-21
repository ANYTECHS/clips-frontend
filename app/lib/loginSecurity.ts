/**
 * app/lib/loginSecurity.ts
 *
 * Suspicious login detection: new-country alerts and impossible-travel checks.
 *
 * Public API:
 *   haversineDistance(a, b)           — great-circle distance in km
 *   isImpossibleTravel(prev, next)    — speed-based travel plausibility check
 *   checkLoginAnomaly(params)         — full anomaly check + alert dispatch
 */

import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { createAuditEvent } from "@/app/lib/auditLog";
import { sendSuspiciousLoginAlert } from "@/app/lib/loginSecurityEmail";
import type { GeoLocation } from "@/app/lib/geoip";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Commercial aircraft cruise ~900 km/h. We use 1 000 km/h as the threshold
 * so the check isn't tripped by residents near a border or fast VPN switching,
 * but catches logins from different continents within a few hours.
 */
export const IMPOSSIBLE_TRAVEL_SPEED_KMH = 1_000;

/**
 * Minimum elapsed time (ms) between two sessions before we bother running
 * the travel check. Sessions created within this window are likely tab
 * reopens from the same device and are not suspicious.
 */
export const MIN_TRAVEL_CHECK_GAP_MS = 5 * 60 * 1_000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TravelCheckInput {
  previous: Coordinate & { createdAt: Date };
  current: Coordinate & { createdAt: Date };
}

export interface AnomalyCheckParams {
  userId: string;
  userEmail: string;
  newSessionId: string;
  newGeo: GeoLocation | null;
  ipAddress: string;
  userAgent: string;
}

export type AnomalyReason = "new_country" | "impossible_travel";

export interface AnomalyResult {
  flagged: boolean;
  reasons: AnomalyReason[];
  /** km between the two coordinates, only set when impossible_travel fires */
  distanceKm?: number;
  /** km/h implied by the distance + time delta */
  impliedSpeedKmh?: number;
}

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6_371;

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * @returns Distance in kilometres.
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinDLon *
      sinDLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(c));
}

// ---------------------------------------------------------------------------
// Impossible-travel check
// ---------------------------------------------------------------------------

/**
 * Returns true when the implied travel speed between `prev` and `next` login
 * locations exceeds {@link IMPOSSIBLE_TRAVEL_SPEED_KMH}.
 *
 * Returns false (not suspicious) when:
 *  - Either coordinate is at (0, 0) — Cloudflare-header-only geo has no coords.
 *  - The two sessions are too close in time to be meaningful.
 *  - Both coordinates are identical (same city).
 */
export function isImpossibleTravel(input: TravelCheckInput): {
  impossible: boolean;
  distanceKm: number;
  impliedSpeedKmh: number;
} {
  const { previous, current } = input;

  // Coordinates at (0, 0) are a sentinel for "unknown" from Cloudflare-only path.
  if (
    (previous.latitude === 0 && previous.longitude === 0) ||
    (current.latitude === 0 && current.longitude === 0)
  ) {
    return { impossible: false, distanceKm: 0, impliedSpeedKmh: 0 };
  }

  const elapsedMs =
    current.createdAt.getTime() - previous.createdAt.getTime();

  // Skip if sessions are too close together (tab reopen, token refresh, etc.)
  if (elapsedMs < MIN_TRAVEL_CHECK_GAP_MS) {
    return { impossible: false, distanceKm: 0, impliedSpeedKmh: 0 };
  }

  const distanceKm = haversineDistance(previous, current);

  if (distanceKm === 0) {
    return { impossible: false, distanceKm: 0, impliedSpeedKmh: 0 };
  }

  const elapsedHours = elapsedMs / (1_000 * 60 * 60);
  const impliedSpeedKmh = distanceKm / elapsedHours;

  return {
    impossible: impliedSpeedKmh > IMPOSSIBLE_TRAVEL_SPEED_KMH,
    distanceKm,
    impliedSpeedKmh,
  };
}

// ---------------------------------------------------------------------------
// Full anomaly check + alert dispatch
// ---------------------------------------------------------------------------

/**
 * Runs all anomaly checks against the user's recent session history and, if
 * anything is flagged, marks the new session as suspicious and sends an
 * alert email.
 *
 * Designed to be called fire-and-forget from {@link createTrackedSession}:
 *
 * ```ts
 * checkLoginAnomaly({ ... }).catch(err =>
 *   logger.error("[LoginSecurity] Anomaly check failed", err)
 * );
 * ```
 *
 * Never throws — all errors are caught and logged so a lookup failure never
 * blocks the user from signing in.
 */
export async function checkLoginAnomaly(
  params: AnomalyCheckParams,
): Promise<AnomalyResult> {
  const { userId, userEmail, newSessionId, newGeo, ipAddress, userAgent } =
    params;

  const result: AnomalyResult = { flagged: false, reasons: [] };

  if (!newGeo) {
    // Can't make location-based decisions without geo data (private IP, etc.)
    return result;
  }

  try {
    // Fetch the most recent *other* session for this user that has geo data.
    const previousSession = await prisma.userSession.findFirst({
      where: {
        userId,
        id: { not: newSessionId },
        revokedAt: null,
        country: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        country: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    // -----------------------------------------------------------------------
    // Check 1 — new country
    // -----------------------------------------------------------------------
    if (
      previousSession?.country &&
      previousSession.country !== newGeo.country
    ) {
      result.reasons.push("new_country");
    }

    // -----------------------------------------------------------------------
    // Check 2 — impossible travel
    // -----------------------------------------------------------------------
    if (
      previousSession &&
      previousSession.latitude !== null &&
      previousSession.longitude !== null
    ) {
      const travelResult = isImpossibleTravel({
        previous: {
          latitude: previousSession.latitude,
          longitude: previousSession.longitude,
          createdAt: previousSession.createdAt,
        },
        current: {
          latitude: newGeo.latitude,
          longitude: newGeo.longitude,
          createdAt: new Date(),
        },
      });

      if (travelResult.impossible) {
        result.reasons.push("impossible_travel");
        result.distanceKm = Math.round(travelResult.distanceKm);
        result.impliedSpeedKmh = Math.round(travelResult.impliedSpeedKmh);
      }
    }

    result.flagged = result.reasons.length > 0;

    if (result.flagged) {
      // Mark session as suspicious in the DB
      await prisma.userSession.update({
        where: { id: newSessionId },
        data: { suspicious: true },
      });

      // Audit trail
      await createAuditEvent({
        actorId: userId,
        action: "auth.suspicious_login",
        resource: "session",
        resourceId: newSessionId,
        ipAddress,
        userAgent,
        status: "failure",
        metadata: {
          reasons: result.reasons,
          newCountry: newGeo.country,
          newCity: newGeo.city,
          previousCountry: previousSession?.country ?? null,
          distanceKm: result.distanceKm ?? null,
          impliedSpeedKmh: result.impliedSpeedKmh ?? null,
        },
      });

      // Alert email
      await sendSuspiciousLoginAlert({
        userEmail,
        sessionId: newSessionId,
        ipAddress,
        userAgent,
        country: newGeo.country,
        city: newGeo.city,
        reasons: result.reasons,
        distanceKm: result.distanceKm,
        impliedSpeedKmh: result.impliedSpeedKmh,
      });
    }
  } catch (error) {
    logger.error("[LoginSecurity] Anomaly check error", { userId, error });
  }

  return result;
}
