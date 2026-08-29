export type SyncFailureCode = "NETWORK_ERROR" | "SYNC_ERROR" | "CONFLICT" | "ABORTED";

export interface SyncErrorOptions {
  resource: string;
  code?: SyncFailureCode;
  retryable?: boolean;
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export class SyncError extends Error {
  readonly resource: string;
  readonly code: SyncFailureCode;
  readonly retryable: boolean;
  readonly cause: unknown;
  readonly metadata: Record<string, unknown>;

  constructor(message: string, options: SyncErrorOptions) {
    super(message);
    this.name = "SyncError";
    this.resource = options.resource;
    this.code = options.code ?? "SYNC_ERROR";
    this.retryable = options.retryable ?? this.code === "NETWORK_ERROR";
    this.cause = options.cause;
    this.metadata = options.metadata ?? {};
  }
}

export interface BackgroundSyncOptions<T> {
  retries?: number;
  retryDelayMs?: number;
  fallbackValue?: T;
  shouldRetry?: (error: SyncError) => boolean;
  onRetry?: (attempt: number, error: SyncError) => void;
  onError?: (error: SyncError) => void;
  onSuccess?: (value: T) => void;
}

const SYNCS_IN_FLIGHT = new Map<string, Promise<unknown>>();

export function normalizeSyncError(resource: string, error: unknown): SyncError {
  if (error instanceof SyncError) {
    return error.resource === resource ? error : new SyncError(error.message, { resource, code: error.code, retryable: error.retryable, cause: error.cause, metadata: error.metadata });
  }

  if (error instanceof Error) {
    const message = error.message || "Unknown sync error";
    const lower = message.toLowerCase();
    const code: SyncFailureCode = lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || lower.includes("offline") || lower.includes("abort") ? "NETWORK_ERROR" : "SYNC_ERROR";
    return new SyncError(message, {
      resource,
      code,
      retryable: code === "NETWORK_ERROR" || /429|5\d\d/.test(lower),
      cause: error,
      metadata: { name: error.name },
    });
  }

  const message = typeof error === "string" ? error : "Unknown sync error";
  return new SyncError(message, {
    resource,
    code: "SYNC_ERROR",
    retryable: false,
    cause: error,
    metadata: { value: error },
  });
}

export async function withSyncErrorHandling<T>(
  resource: string,
  syncFn: () => Promise<T>,
  options: BackgroundSyncOptions<T> = {},
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 0);
  const retryDelayMs = options.retryDelayMs ?? 250;
  let attempt = 0;

  while (true) {
    try {
      const value = await syncFn();
      options.onSuccess?.(value);
      return value;
    } catch (error) {
      const syncError = normalizeSyncError(resource, error);
      const shouldRetry = retries > attempt && (options.shouldRetry?.(syncError) ?? syncError.retryable);

      if (shouldRetry) {
        attempt += 1;
        options.onRetry?.(attempt, syncError);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        continue;
      }

      options.onError?.(syncError);
      if (options.fallbackValue !== undefined) {
        return options.fallbackValue;
      }

      throw syncError;
    }
  }
}

export function scheduleBackgroundSync<T>(
  resource: string,
  syncFn: () => Promise<T>,
  options: BackgroundSyncOptions<T> = {},
): Promise<T> {
  const existing = SYNCS_IN_FLIGHT.get(resource) as Promise<T> | undefined;
  if (existing) return existing;

  const task = withSyncErrorHandling(resource, syncFn, options).finally(() => {
    if (SYNCS_IN_FLIGHT.get(resource) === task) {
      SYNCS_IN_FLIGHT.delete(resource);
    }
  });

  SYNCS_IN_FLIGHT.set(resource, task);
  return task;
}

export function getInFlightSyncCount(): number {
  return SYNCS_IN_FLIGHT.size;
}
