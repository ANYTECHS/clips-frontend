/**
 * Recovery session and config store.
 *
 * Uses Redis (via ioredis) when REDIS_URL is set, falling back to an
 * in-memory Map for local dev and tests. Sessions expire after SESSION_TTL_S
 * seconds to prevent stale recovery attempts from lingering.
 *
 * Data shapes mirror the mock implementations in app/lib/mockApi.ts so that
 * the real routes behave identically to the mock ones.
 */

import Redis from "ioredis";

export const SESSION_TTL_S = 3600; // 1 hour

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuardianEntry = {
  email: string;
  shareId: string;
};

export type RecoveryConfig = {
  /** Account owner email. */
  email: string;
  threshold: number;
  guardians: GuardianEntry[];
};

export type SessionGuardian = {
  email: string;
  approved: boolean;
  shareId: string;
};

export type RecoverySession = {
  id: string;
  email: string;
  threshold: number;
  guardians: SessionGuardian[];
  /** epoch ms — informational; the backing store enforces the real TTL */
  expiresAt: number;
};

// ── Storage adapter interface ─────────────────────────────────────────────────

interface StorageAdapter {
  get(key: string): Promise<string | null>;
  /** Set a key with an explicit TTL in seconds. */
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  /** Test-mode flush. */
  flushdb?(): Promise<unknown>;
}

// ── Redis adapter ─────────────────────────────────────────────────────────────

class RedisStorageAdapter implements StorageAdapter {
  constructor(private readonly client: Redis) {}

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<unknown> {
    return this.client.set(key, value, "EX", ttlSeconds);
  }

  del(key: string): Promise<unknown> {
    return this.client.del(key);
  }
}

// ── In-memory adapter (dev / test) ────────────────────────────────────────────

class InMemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<unknown> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
    return "OK";
  }

  async del(key: string): Promise<unknown> {
    this.map.delete(key);
    return 1;
  }

  async flushdb(): Promise<unknown> {
    this.map.clear();
    return "OK";
  }
}

// ── Repository class ──────────────────────────────────────────────────────────

export class RecoveryRepository {
  constructor(private readonly adapter: StorageAdapter) {}

  // ── Recovery configs (written during wallet setup) ────────────────────────

  private configKey(email: string): string {
    return `recovery:config:${email.toLowerCase()}`;
  }

  /** Persist a recovery config. TTL is intentionally long (30 days). */
  async setConfig(config: RecoveryConfig): Promise<void> {
    await this.adapter.set(
      this.configKey(config.email),
      JSON.stringify(config),
      30 * 24 * 3_600
    );
  }

  async getConfig(email: string): Promise<RecoveryConfig | null> {
    const raw = await this.adapter.get(this.configKey(email));
    if (!raw) return null;
    return JSON.parse(raw) as RecoveryConfig;
  }

  // ── Guardian shares ────────────────────────────────────────────────────────

  private shareKey(shareId: string): string {
    return `recovery:share:${shareId}`;
  }

  async setShare(shareId: string, shareValue: string): Promise<void> {
    await this.adapter.set(this.shareKey(shareId), shareValue, 30 * 24 * 3_600);
  }

  async getShare(shareId: string): Promise<string | null> {
    return this.adapter.get(this.shareKey(shareId));
  }

  // ── Recovery sessions (short-lived) ───────────────────────────────────────

  private sessionKey(sessionId: string): string {
    return `recovery:session:${sessionId}`;
  }

  async createSession(session: RecoverySession): Promise<void> {
    await this.adapter.set(
      this.sessionKey(session.id),
      JSON.stringify(session),
      SESSION_TTL_S
    );
  }

  async getSession(sessionId: string): Promise<RecoverySession | null> {
    const raw = await this.adapter.get(this.sessionKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as RecoverySession;
  }

  async saveSession(sessionId: string, session: RecoverySession): Promise<void> {
    await this.adapter.set(
      this.sessionKey(sessionId),
      JSON.stringify(session),
      SESSION_TTL_S
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.adapter.del(this.sessionKey(sessionId));
  }

  /** Test helper — wipes the store. */
  async clear(): Promise<void> {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("RecoveryRepository.clear() is only allowed in test mode");
    }
    await this.adapter.flushdb?.();
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let _instance: RecoveryRepository | null = null;

export function getRecoveryRepository(): RecoveryRepository {
  if (_instance) return _instance;

  if (process.env.NODE_ENV !== "test" && process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL);
    _instance = new RecoveryRepository(new RedisStorageAdapter(redis));
  } else {
    _instance = new RecoveryRepository(new InMemoryStorageAdapter());
  }

  return _instance;
}

/** Reset the singleton — test use only. */
export function __resetRecoveryRepository(): void {
  _instance = null;
}
