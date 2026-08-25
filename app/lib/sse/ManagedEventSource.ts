/**
 * A lifecycle-managed wrapper around `EventSource`.
 *
 * The browser's own `EventSource` reconnects on its own, immediately and
 * forever, with no cap and no backoff. A server that is down therefore gets
 * hammered by every open tab, and because the native retry keeps the object
 * alive, a stream whose owner forgot to `close()` it survives navigation and
 * leaks — listeners, timers and all.
 *
 * This wrapper takes that over:
 *
 * - the native retry is disabled by closing the socket on the first error, and
 *   reconnection is driven here with exponential backoff and jitter
 * - reconnection stops after `maxRetries`, handing control back to the caller
 *   via `onGiveUp` (typically to fall back to polling)
 * - every connection is registered in a process-wide pool with a hard limit, so
 *   a leak shows up as a thrown error at the point of the leak rather than as
 *   mysterious browser-level connection starvation later
 * - `close()` is idempotent and tears down the socket, the pending retry timer
 *   and the pool registration together
 *
 * Browsers cap concurrent HTTP/1.1 connections per origin at six, and an open
 * SSE stream holds one of those for its whole life. Four is deliberately under
 * that ceiling so ordinary requests are never starved by streams.
 */

export const DEFAULT_MAX_CONNECTIONS = 4;
export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;

export interface ManagedEventSourceOptions {
  /** Stream URL. */
  url: string;
  /**
   * Named event types to subscribe to. `message` covers unnamed events.
   * Handlers receive the already-parsed `event.data` string.
   */
  listeners?: Record<string, (data: string, event: MessageEvent) => void>;
  /** Called after each failed connection, with the 1-based attempt number. */
  onError?: (attempt: number, willRetry: boolean) => void;
  /** Called once when `maxRetries` is exhausted. The connection is closed by then. */
  onGiveUp?: () => void;
  /** Called each time a connection opens, including reconnections. */
  onOpen?: () => void;
  /** Reconnection attempts before giving up. Default 5. */
  maxRetries?: number;
  /** First backoff delay in ms; doubles each attempt. Default 1000. */
  initialRetryDelayMs?: number;
  /** Ceiling for the backoff delay in ms. Default 30000. */
  maxRetryDelayMs?: number;
  /** Injectable for tests. */
  eventSourceFactory?: (url: string) => EventSource;
  /** Injectable for tests; must return a value in [0, 1). */
  random?: () => number;
}

/** Connections currently held open, process-wide. */
const pool = new Set<ManagedEventSource>();
let maxConnections = DEFAULT_MAX_CONNECTIONS;

/** Raised when opening a stream would exceed the connection pool limit. */
export class ConnectionPoolExhaustedError extends Error {
  constructor(limit: number) {
    super(
      `Refusing to open another SSE connection: ${limit} are already open. ` +
        "This usually means a stream was not closed when its owner unmounted.",
    );
    this.name = "ConnectionPoolExhaustedError";
  }
}

/** Number of streams currently open. Exposed for diagnostics and tests. */
export function openConnectionCount(): number {
  return pool.size;
}

/** Adjust the pool limit. Intended for tests and for deliberate app-level tuning. */
export function setMaxConnections(limit: number): void {
  if (limit < 1) throw new Error("maxConnections must be at least 1");
  maxConnections = limit;
}

export function getMaxConnections(): number {
  return maxConnections;
}

/** Close every open stream. Used by tests; also a usable panic button. */
export function closeAllConnections(): void {
  for (const connection of [...pool]) {
    connection.close();
  }
}

export class ManagedEventSource {
  private readonly options: Required<
    Pick<
      ManagedEventSourceOptions,
      "url" | "maxRetries" | "initialRetryDelayMs" | "maxRetryDelayMs"
    >
  > &
    ManagedEventSourceOptions;

  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private closed = false;

  constructor(options: ManagedEventSourceOptions) {
    this.options = {
      maxRetries: DEFAULT_MAX_RETRIES,
      initialRetryDelayMs: DEFAULT_INITIAL_RETRY_DELAY_MS,
      maxRetryDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
      ...options,
    };

    if (pool.size >= maxConnections) {
      throw new ConnectionPoolExhaustedError(maxConnections);
    }
    pool.add(this);

    this.connect();
  }

  /** True once `close()` has run. */
  get isClosed(): boolean {
    return this.closed;
  }

  /** Reconnection attempts made since the last successful message. */
  get retryCount(): number {
    return this.attempt;
  }

  /**
   * Delay before retry `attempt`, doubling from `initialRetryDelayMs` and
   * capped at `maxRetryDelayMs`, with up to 25% jitter subtracted.
   *
   * The jitter matters: without it, every tab that lost the same server comes
   * back at the same instant and knocks it over again.
   */
  private backoffDelay(attempt: number): number {
    const { initialRetryDelayMs, maxRetryDelayMs, random } = this.options;
    const exponential = initialRetryDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exponential, maxRetryDelayMs);
    const jitterFactor = 1 - 0.25 * (random ?? Math.random)();
    return Math.round(capped * jitterFactor);
  }

  private connect(): void {
    if (this.closed) return;

    const factory =
      this.options.eventSourceFactory ?? ((url: string) => new EventSource(url));
    const source = factory(this.options.url);
    this.source = source;

    source.onopen = () => {
      if (this.closed) return;
      this.options.onOpen?.();
    };

    for (const [eventName, handler] of Object.entries(this.options.listeners ?? {})) {
      source.addEventListener(eventName, ((event: MessageEvent) => {
        if (this.closed) return;
        // A frame arriving means the connection is healthy, so the backoff
        // ladder resets — otherwise a stream that blips once an hour would
        // eventually be waiting 30 seconds to recover from each blip.
        this.attempt = 0;
        handler(event.data, event);
      }) as EventListener);
    }

    source.onerror = () => {
      if (this.closed) return;

      // Close first: the native implementation would otherwise start its own
      // uncapped retry loop alongside ours.
      source.close();
      this.source = null;

      this.attempt += 1;
      const willRetry = this.attempt <= this.options.maxRetries;
      this.options.onError?.(this.attempt, willRetry);

      if (!willRetry) {
        this.close();
        this.options.onGiveUp?.();
        return;
      }

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.connect();
      }, this.backoffDelay(this.attempt));
    };
  }

  /** Tear everything down. Safe to call more than once. */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    pool.delete(this);
  }
}

/**
 * Open a managed stream, or return `null` when `EventSource` is unavailable
 * (server rendering, or a browser without support) so callers can fall back
 * without branching on `typeof` themselves.
 */
export function openManagedEventSource(
  options: ManagedEventSourceOptions,
): ManagedEventSource | null {
  if (!options.eventSourceFactory && typeof EventSource === "undefined") {
    return null;
  }
  return new ManagedEventSource(options);
}
