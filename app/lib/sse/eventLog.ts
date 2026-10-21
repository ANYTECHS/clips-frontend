/**
 * Server-side SSE event log with resumable, monotonically increasing IDs.
 *
 * Every frame a stream emits is tagged with an `id:` so the client can tell the
 * server where it left off (`Last-Event-ID`). The log keeps the most recent
 * frames per stream key so a client that reconnects after a network blip gets
 * the frames it missed replayed instead of silently skipping them.
 *
 * IDs are derived from the wall clock (`max(Date.now(), previous + 1)`), so
 * they keep increasing even across a server restart or when a reconnect lands
 * on a different instance that has never seen the stream. In that case the
 * log is empty and callers fall back to sending the current snapshot.
 *
 * The log lives in process memory. Job state itself stays in the job store
 * (Redis/in-memory); because each job frame is a full snapshot of that state,
 * the latest snapshot is always a correct substitute for frames this instance
 * no longer holds.
 */

export const DEFAULT_MAX_EVENTS_PER_STREAM = 100;
/** Logs untouched for this long are dropped so finished jobs don't pin memory. */
export const STREAM_LOG_TTL_MS = 60 * 60 * 1_000;

export interface SseEvent {
  id: number;
  /** Named event type; omitted for the default `message` event. */
  event?: string;
  data: string;
}

interface StreamLog {
  lastId: number;
  events: SseEvent[];
  touchedAt: number;
}

export class SseEventLog {
  private readonly logs = new Map<string, StreamLog>();

  constructor(
    private readonly maxEvents: number = DEFAULT_MAX_EVENTS_PER_STREAM,
    private readonly now: () => number = Date.now,
  ) {}

  private getLog(key: string): StreamLog {
    this.evictStale();
    let log = this.logs.get(key);
    if (!log) {
      log = { lastId: 0, events: [], touchedAt: this.now() };
      this.logs.set(key, log);
    }
    log.touchedAt = this.now();
    return log;
  }

  private evictStale(): void {
    const cutoff = this.now() - STREAM_LOG_TTL_MS;
    for (const [key, log] of this.logs) {
      if (log.touchedAt < cutoff) this.logs.delete(key);
    }
  }

  /** Allocate the next ID for `key` without storing a frame (for transient events). */
  nextId(key: string): number {
    const log = this.getLog(key);
    log.lastId = Math.max(this.now(), log.lastId + 1);
    return log.lastId;
  }

  /**
   * Record a frame for `key`. When `data` and `event` are identical to the most
   * recent frame the existing frame is returned and `isNew` is false, so
   * pollers can skip re-sending unchanged state.
   */
  append(key: string, data: string, event?: string): { event: SseEvent; isNew: boolean } {
    const log = this.getLog(key);
    const latest = log.events[log.events.length - 1];
    if (latest && latest.data === data && latest.event === event) {
      return { event: latest, isNew: false };
    }

    const entry: SseEvent = { id: this.nextId(key), data, ...(event ? { event } : {}) };
    log.events.push(entry);
    if (log.events.length > this.maxEvents) {
      log.events.splice(0, log.events.length - this.maxEvents);
    }
    return { event: entry, isNew: true };
  }

  /** Frames for `key` with an ID strictly greater than `lastEventId`, oldest first. */
  since(key: string, lastEventId: number): SseEvent[] {
    const log = this.logs.get(key);
    if (!log) return [];
    return log.events.filter((e) => e.id > lastEventId);
  }

  /** Most recent frame recorded for `key`, if any. */
  latest(key: string): SseEvent | undefined {
    const log = this.logs.get(key);
    return log?.events[log.events.length - 1];
  }

  delete(key: string): void {
    this.logs.delete(key);
  }

  clear(): void {
    this.logs.clear();
  }
}

/** Shared log for job progress streams. */
export const jobEventLog = new SseEventLog();

/** Serialise a frame in the `text/event-stream` wire format. */
export function formatSseEvent(event: SseEvent): string {
  const lines = [`id: ${event.id}`];
  if (event.event) lines.push(`event: ${event.event}`);
  for (const line of event.data.split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

/**
 * Read the client's resume point. Native `EventSource` reconnects send the
 * `Last-Event-ID` header; managed reconnects (which open a fresh
 * `EventSource` and so cannot set headers) pass it as a `lastEventId` query
 * parameter instead. Returns `null` when absent or malformed.
 */
export function parseLastEventId(request: Request): number | null {
  const fromHeader = request.headers.get("last-event-id");
  const fromQuery = new URL(request.url).searchParams.get("lastEventId");
  const raw = fromHeader ?? fromQuery;
  if (raw === null || raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
