/**
 * circuitBreaker.ts
 *
 * A process-scoped circuit breaker registry for external service calls.
 *
 * States
 * ──────
 *  CLOSED   — Normal operation. Calls pass through.
 *  OPEN     — Service is presumed down. Calls are rejected immediately
 *             (fail-fast). After `resetTimeoutMs` the breaker half-opens.
 *  HALF_OPEN — One probe call is allowed through. If it succeeds the breaker
 *             closes; if it fails it re-opens.
 *
 * Usage
 * ──────
 * ```ts
 * const cb = getCircuitBreaker("aiBackend");
 * const result = await cb.execute(
 *   () => dispatchToAI(payload),  // primary
 *   () => ({ dispatched: false, reason: "CIRCUIT_OPEN" }) // fallback
 * );
 * ```
 *
 * The registry is module-level so breakers survive across requests within
 * a single Node.js process (a Next.js server worker). They are NOT shared
 * across multiple workers — in a multi-instance deployment each worker
 * maintains its own counters, which is acceptable: a breaker that opens in
 * one worker is simply a local rate-limit, not a global lock.
 */

import { logger } from "@/app/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures required to open the breaker.
   * Default: 5
   */
  failureThreshold?: number;
  /**
   * Number of consecutive successes required in HALF_OPEN to close the breaker.
   * Default: 2
   */
  successThreshold?: number;
  /**
   * How long (ms) to stay OPEN before moving to HALF_OPEN.
   * Default: 60 000 (1 minute)
   */
  resetTimeoutMs?: number;
  /**
   * Optional callback fired on every state transition.
   */
  onStateChange?: (
    name: string,
    from: CircuitState,
    to: CircuitState
  ) => void;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  totalCalls: number;
  totalFailures: number;
  totalFallbacks: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_SUCCESS_THRESHOLD = 2;
const DEFAULT_RESET_TIMEOUT_MS = 60_000;

// ─── CircuitBreaker class ─────────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private openedAt: number | null = null;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalFallbacks = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly onStateChange?: CircuitBreakerOptions["onStateChange"];

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    this.resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
    this.onStateChange = options.onStateChange;
  }

  // ── State transition helpers ──────────────────────────────────────────────

  private transition(to: CircuitState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    logger.info(
      `[CircuitBreaker:${this.name}] ${from} → ${to}`
    );
    this.onStateChange?.(this.name, from, to);
  }

  private open(): void {
    this.openedAt = Date.now();
    this.consecutiveSuccesses = 0;
    this.transition("OPEN");
  }

  private close(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.openedAt = null;
    this.transition("CLOSED");
  }

  // ── Outcome recording ─────────────────────────────────────────────────────

  private recordSuccess(): void {
    this.lastSuccessAt = Date.now();
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses += 1;

    if (
      this.state === "HALF_OPEN" &&
      this.consecutiveSuccesses >= this.successThreshold
    ) {
      this.close();
    }
  }

  private recordFailure(): void {
    this.lastFailureAt = Date.now();
    this.totalFailures += 1;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures += 1;

    if (
      this.state === "CLOSED" &&
      this.consecutiveFailures >= this.failureThreshold
    ) {
      logger.warn(
        `[CircuitBreaker:${this.name}] Failure threshold reached ` +
          `(${this.consecutiveFailures}/${this.failureThreshold}) — opening circuit`
      );
      this.open();
    } else if (this.state === "HALF_OPEN") {
      // A single failure in HALF_OPEN re-opens.
      logger.warn(
        `[CircuitBreaker:${this.name}] Probe failed in HALF_OPEN — re-opening circuit`
      );
      this.open();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Whether the breaker will currently let calls through.
   * Returns false when OPEN and the reset timeout hasn't elapsed.
   * Returns true when CLOSED or HALF_OPEN.
   */
  get isCallable(): boolean {
    if (this.state === "CLOSED") return true;
    if (this.state === "HALF_OPEN") return true;

    // OPEN — check if the reset window has elapsed
    if (
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.transition("HALF_OPEN");
      return true;
    }

    return false;
  }

  /**
   * Current breaker state (read-only snapshot).
   */
  get currentState(): CircuitState {
    // Lazily promote OPEN → HALF_OPEN if the window elapsed.
    void this.isCallable;
    return this.state;
  }

  /**
   * Execute `primary`, falling back to `fallback` when the circuit is open
   * or when `primary` throws.
   *
   * - CLOSED / HALF_OPEN: runs `primary`.
   *   - On success: records a success, returns the value.
   *   - On failure: records a failure, runs `fallback`.
   * - OPEN: skips `primary`, runs `fallback` immediately.
   *
   * `fallback` should never throw. If it does the error propagates.
   */
  async execute<T>(
    primary: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    this.totalCalls += 1;

    if (!this.isCallable) {
      logger.warn(
        `[CircuitBreaker:${this.name}] Circuit OPEN — using fallback without calling primary`
      );
      this.totalFallbacks += 1;
      return fallback();
    }

    try {
      const result = await primary();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      logger.warn(
        `[CircuitBreaker:${this.name}] Primary call failed — using fallback. Error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      this.totalFallbacks += 1;
      return fallback();
    }
  }

  /**
   * Execute `primary` with no fallback. Throws on failure (and records it).
   * Throws `CircuitOpenError` immediately when the circuit is open.
   */
  async executeOrThrow<T>(primary: () => Promise<T>): Promise<T> {
    this.totalCalls += 1;

    if (!this.isCallable) {
      const err = new CircuitOpenError(this.name);
      this.totalFallbacks += 1;
      throw err;
    }

    try {
      const result = await primary();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /**
   * Manually reset the breaker to CLOSED. Useful for testing or admin actions.
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.transition("CLOSED");
    this.openedAt = null;
  }

  /**
   * Returns a read-only snapshot of the breaker's current metrics.
   */
  snapshot(): CircuitBreakerSnapshot {
    return {
      name: this.name,
      state: this.currentState,
      failures: this.consecutiveFailures,
      successes: this.consecutiveSuccesses,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalFallbacks: this.totalFallbacks,
    };
  }
}

// ─── CircuitOpenError ─────────────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  constructor(public readonly serviceName: string) {
    super(`Circuit breaker OPEN for service: ${serviceName}`);
    this.name = "CircuitOpenError";
  }
}

// ─── Process-scoped registry ──────────────────────────────────────────────────

/**
 * Named circuit breaker configurations for each external dependency.
 */
export const CIRCUIT_BREAKER_CONFIGS: Record<
  string,
  Required<Omit<CircuitBreakerOptions, "onStateChange">>
> = {
  aiBackend: {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 60_000,
  },
  virusScan: {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 120_000, // longer — scan outages tend to be sustained
  },
  cloudStorage: {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeoutMs: 30_000,
  },
};

// Module-level map — one breaker per named service per worker process.
const registry = new Map<string, CircuitBreaker>();

/**
 * Retrieve (or create) a named circuit breaker.
 * Subsequent calls with the same name return the same instance.
 */
export function getCircuitBreaker(name: string): CircuitBreaker {
  if (!registry.has(name)) {
    const config = CIRCUIT_BREAKER_CONFIGS[name] ?? {};
    registry.set(name, new CircuitBreaker(name, config));
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return registry.get(name)!;
}

/**
 * Return snapshots of every registered breaker.
 * Used by the /api/health/circuit-breakers diagnostic endpoint.
 */
export function allCircuitBreakerSnapshots(): CircuitBreakerSnapshot[] {
  return Array.from(registry.values()).map((cb) => cb.snapshot());
}

/**
 * Reset all breakers. Intended for testing only.
 */
export function resetAllCircuitBreakers(): void {
  for (const cb of registry.values()) {
    cb.reset();
  }
}
