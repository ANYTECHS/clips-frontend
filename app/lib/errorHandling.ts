/**
 * Standardized error handling utilities for consistent error patterns across the codebase.
 * @module errorHandling
 */

export type AppError = {
  message: string;
  code?: string;
  status?: number;
};

/**
 * Extracts a user-friendly error message from various error types.
 * Handles Error instances, API error responses, and unknown error types.
 *
 * @param error - The error to extract a message from
 * @param fallback - Default message if extraction fails (default: "An unexpected error occurred")
 * @returns A user-friendly error message string
 *
 * @example
 * ```ts
 * try {
 *   await fetchData();
 * } catch (err) {
 *   showToast(getErrorMessage(err), "error");
 * }
 * ```
 */
export function getErrorMessage(error: unknown, fallback = "An unexpected error occurred"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

/**
 * Wraps an async function with standardized error handling.
 * Returns a tuple of [data, error] for clean error handling without try/catch.
 *
 * @param fn - The async function to wrap
 * @returns A tuple where [data, null] on success or [null, AppError] on failure
 *
 * @example
 * ```ts
 * const [user, err] = await safeAsync(() => fetchUser(id));
 * if (err) {
 *   showToast(err.message, "error");
 *   return;
 * }
 * ```
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, AppError]> {
  try {
    const data = await fn();
    return [data, null];
  } catch (error) {
    return [null, { message: getErrorMessage(error) }];
  }
}

/**
 * Handles API response errors consistently.
 * Throws with a descriptive message if the response is not ok.
 *
 * @param response - The fetch Response object
 * @param context - Optional context string for error messages (e.g., "fetching projects")
 * @returns The parsed JSON response
 * @throws {Error} If the response status indicates an error
 *
 * @example
 * ```ts
 * const res = await fetch("/api/projects");
 * const data = await handleApiResponse(res, "loading projects");
 * ```
 */
export async function handleApiResponse<T = unknown>(
  response: Response,
  context?: string
): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const detail = errorBody?.error || errorBody?.message;
    const prefix = context ? `Error ${context}` : "Request failed";
    throw new Error(detail ? `${prefix}: ${detail}` : `${prefix} (${response.status})`);
  }
  return response.json();
}
