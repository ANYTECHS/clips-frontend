import Redis from "ioredis";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/app/lib/logger";

import type { Job } from "./jobStore";
import { getRedisClient, isRedisAvailable, checkRedisHealth } from "./redisClient";

interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  getAll?(): Promise<string[]>;
  flushdb?(): Promise<unknown>;
}

export class JobRepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "JobRepositoryError";
  }
}

class RedisStorageAdapter implements StorageAdapter {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error("[RedisStorageAdapter] get() failed:", error);
      throw error;
    }
  }

  async set(key: string, value: string): Promise<unknown> {
    try {
      return await this.client.set(key, value);
    } catch (error) {
      logger.error("[RedisStorageAdapter] set() failed:", error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error("[RedisStorageAdapter] del() failed:", error);
      throw error;
    }
  }

  async getAll(): Promise<string[]> {
    try {
      const keys = await this.client.keys("job:*");
      if (keys.length === 0) return [];
      const values = await this.client.mget(...keys);
      return values.filter((val): val is string => val !== null);
    } catch (error) {
      logger.error("[RedisStorageAdapter] getAll() failed:", error);
      throw error;
    }
  }

  async flushdb(): Promise<unknown> {
    try {
      return await this.client.flushdb();
    } catch (error) {
      logger.error("[RedisStorageAdapter] flushdb() failed:", error);
      throw error;
    }
  }
}

export type StorageMode = "redis" | "memory";

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  async set(key: string, value: string): Promise<unknown> {
    this.map.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.map.delete(key) ? 1 : 0;
  }

  async getAll(): Promise<string[]> {
    return Array.from(this.map.values());
  }

  async flushdb(): Promise<unknown> {
    this.map.clear();
    return "OK";
  }
}

export class JobRepository {
  private adapter: StorageAdapter;
  private mode: StorageMode = "memory";
  private inMemoryCache = new Map<string, Job>();
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
    this.mode = adapter instanceof RedisStorageAdapter ? "redis" : "memory";
  }

  private key(jobId: string): string {
    return `job:${jobId}`;
  }

  async get(jobId: string): Promise<Job | null> {
    await this.checkHealthAndSwitch();
    try {
      const raw = await this.adapter.get(this.key(jobId));
      if (!raw) return null;
      return JSON.parse(raw) as Job;
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error(`[JobRepository] failed to read job ${jobId}:`, cause);
      throw new JobRepositoryError(`Unable to read job state for ${jobId}`, cause);
    }
  }

  async set(jobId: string, jobData: Job): Promise<void> {
    await this.checkHealthAndSwitch();
    try {
      await this.adapter.set(this.key(jobId), JSON.stringify(jobData));
      // Also update in-memory cache if in memory mode
      if (this.mode === "memory") {
        this.inMemoryCache.set(jobId, jobData);
      }
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error(`[JobRepository] failed to write job ${jobId}:`, cause);
      throw new JobRepositoryError(`Unable to persist job state for ${jobId}`, cause);
    }
  }

  async delete(jobId: string): Promise<boolean> {
    await this.checkHealthAndSwitch();
    try {
      const result = await this.adapter.del(this.key(jobId));
      // Also remove from in-memory cache
      this.inMemoryCache.delete(jobId);
      return result > 0;
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error(`[JobRepository] failed to delete job ${jobId}:`, cause);
      throw new JobRepositoryError(`Unable to delete job state for ${jobId}`, cause);
    }
  }

  async getAll(): Promise<Job[]> {
    try {
      if (typeof this.adapter.getAll === "function") {
        const raws = await this.adapter.getAll();
        return raws.map((raw) => JSON.parse(raw) as Job);
      }
      return [];
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error("[JobRepository] failed to get all jobs:", cause);
      throw new JobRepositoryError("Unable to retrieve all jobs", cause);
    }
  }

  async getUserJobs(userId: string): Promise<Job[]> {
    const allJobs = await this.getAll();
    return allJobs.filter((job) => job.userId === userId);
  }

  async clear(): Promise<void> {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("JobRepository.clear() is only supported in test mode");
    }

    if (typeof this.adapter.flushdb !== "function") {
      throw new Error("JobRepository.clear() is not supported by the current storage adapter");
    }

    await this.adapter.flushdb();
  }

  /**
   * Get the current storage mode
   */
  getMode(): StorageMode {
    return this.mode;
  }

  /**
   * Perform health check and switch modes if needed
   */
  private async checkHealthAndSwitch(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
      return;
    }
    this.lastHealthCheck = now;

    const isRedisHealthy = await checkRedisHealth();

    if (this.mode === "redis" && !isRedisHealthy) {
      // Redis failed - switch to in-memory
      logger.critical(
        "[JobRepository] Redis health check failed - switching to in-memory storage"
      );
      Sentry.captureMessage("Redis failover to in-memory storage", {
        level: "error",
        tags: {
          component: "jobRepository",
          operation: "failover",
          from: "redis",
          to: "memory",
        },
      });

      // Cache all existing jobs before switching
      await this.cacheAllJobs();

      this.adapter = new InMemoryStorageAdapter();
      this.mode = "memory";
    } else if (this.mode === "memory" && isRedisHealthy) {
      // Redis recovered - sync back and switch
      logger.info("[JobRepository] Redis recovered - syncing in-memory jobs back to Redis");

      try {
        await this.syncToRedis();
        const redisClient = getRedisClient();
        if (redisClient) {
          this.adapter = new RedisStorageAdapter(redisClient);
          this.mode = "redis";
          this.inMemoryCache.clear();
          logger.info("[JobRepository] Successfully switched back to Redis storage");
        }
      } catch (error) {
        logger.error("[JobRepository] Failed to sync to Redis, staying in memory mode:", error);
        Sentry.captureException(error, {
          tags: {
            component: "jobRepository",
            operation: "redis_recovery",
          },
        });
      }
    }
  }

  /**
   * Cache all jobs from current adapter to in-memory map
   */
  private async cacheAllJobs(): Promise<void> {
    try {
      const jobs = await this.getAll();
      for (const job of jobs) {
        this.inMemoryCache.set(job.id, job);
      }
      logger.info(`[JobRepository] Cached ${jobs.length} jobs to in-memory storage`);
    } catch (error) {
      logger.error("[JobRepository] Failed to cache jobs:", error);
    }
  }

  /**
   * Sync in-memory jobs back to Redis
   */
  private async syncToRedis(): Promise<void> {
    const redisClient = getRedisClient();
    if (!redisClient) {
      throw new Error("Redis client not available for sync");
    }

    const redisAdapter = new RedisStorageAdapter(redisClient);
    let synced = 0;

    for (const [jobId, job] of this.inMemoryCache) {
      try {
        await redisAdapter.set(this.key(jobId), JSON.stringify(job));
        synced++;
      } catch (error) {
        logger.error(`[JobRepository] Failed to sync job ${jobId}:`, error);
      }
    }

    logger.info(`[JobRepository] Synced ${synced}/${this.inMemoryCache.size} jobs to Redis`);
  }
}

export function createJobRepository(): JobRepository {
  // In test mode, always use in-memory storage
  if (process.env.NODE_ENV === "test") {
    logger.debug("[JobRepository] Using in-memory storage (test mode)");
    return new JobRepository(new InMemoryStorageAdapter());
  }

  // Try to get Redis client from the singleton manager
  const redisClient = getRedisClient();

  if (!redisClient) {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      logger.warn(
        "[JobRepository] Redis not available in production - falling back to in-memory storage. " +
          "Job state will NOT persist across serverless instances!"
      );
    } else {
      logger.info("[JobRepository] Using in-memory storage (development mode)");
    }

    return new JobRepository(new InMemoryStorageAdapter());
  }

  // Check if Redis is actually connected before using it
  if (!isRedisAvailable()) {
    logger.warn(
      "[JobRepository] Redis client exists but not connected - falling back to in-memory storage"
    );
    return new JobRepository(new InMemoryStorageAdapter());
  }

  logger.info("[JobRepository] Using Redis storage with connection pooling");
  return new JobRepository(new RedisStorageAdapter(redisClient));
}
