import { fetchUserFromAPI } from "@/app/store/api";
import { USER_PROFILE_CACHE_KEY } from "@/app/store/userStore";
import { requestCache, type RequestCache } from "./RequestCache";
import type { UserProfile } from "@/app/store/types";

/**
 * Warm data needed immediately by the authenticated dashboard shell.
 * The profile is shared by the header and quota panel, so one request benefits
 * both consumers and is reused by the user store when they mount.
 */
export function warmCriticalData(
  signal?: AbortSignal,
  cache: RequestCache = requestCache,
): Promise<UserProfile> {
  return cache.fetch(USER_PROFILE_CACHE_KEY, fetchUserFromAPI, {
    priority: "high",
    signal,
  });
}