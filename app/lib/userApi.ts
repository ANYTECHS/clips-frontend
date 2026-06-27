/**
 * Thin server-side client for user-related backend endpoints.
 *
 * These functions are intentionally kept framework-agnostic (plain fetch) so
 * they can be called from NextAuth callbacks, which run in the Node.js runtime,
 * not the Edge runtime.
 */

import { logger } from "@/app/lib/logger";
import { DEFAULT_ONBOARDING_STEP } from "./types";

export type UserProfile = {
  onboardingStep: number;
};

/**
 * Fetch the current onboarding step for a user from the real backend.
 *
 * Falls back to DEFAULT_ONBOARDING_STEP if the request fails or the backend
 * is unreachable — this prevents a missing API from breaking authentication
 * entirely during development or outages.
 *
 * @param email - The user's email address.
 * @param accessToken - The OAuth access token to authenticate the request.
 */
export async function fetchOnboardingStep(
  email: string,
  accessToken?: string
): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    // No backend configured — expected in local dev without a real API.
    return DEFAULT_ONBOARDING_STEP;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const url = `${baseUrl}/api/users/me/onboarding-step?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      logger.warn(
        `[userApi] fetchOnboardingStep returned ${res.status} for ${email}; falling back to default.`
      );
      return DEFAULT_ONBOARDING_STEP;
    }

    const data = (await res.json()) as { onboardingStep?: unknown };
    const step = data?.onboardingStep;
    return typeof step === "number" ? step : DEFAULT_ONBOARDING_STEP;
  } catch (err) {
    logger.warn("[userApi] fetchOnboardingStep failed; falling back to default.", err);
    return DEFAULT_ONBOARDING_STEP;
  }
}
