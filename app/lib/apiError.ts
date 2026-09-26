/**
 * Normalized error type for API calls, so every data-fetching hook throws
 * (and every consumer can check) the same shape instead of a mix of
 * `Error`, parsed JSON bodies, and raw `Response` objects.
 */
export class ApiError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

/**
 * `fetch` wrapper used by the unified data-fetching hooks (`useApiQuery`,
 * `useApiMutation`). Throws `ApiError` on a non-2xx response instead of
 * resolving with an "ok: false" body, so a single `catch` / `error` field
 * handles every failure.
 */
export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(err instanceof Error ? err.message : "Network request failed", 0);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (!res.ok) {
    const message =
      (isJson && body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : undefined) ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}
