import Redis from "ioredis";
import type { Job } from "./jobStore";
import { logger } from "@/app/lib/logger";

interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  flushdb?(): Promise<unknown>;
}

export class JobRepositoryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "JobRepositoryError";
  }
}

class RedisStorageAdapter implements StorageAdapter {
  constructor(private readonly client: Redis) {}

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  set(key: string, value: string): Promise<unknown> {
    return this.client.set(key, value);
  }

  del(key: string): Promise<number> {
    return this.client.del(key);
  }

  flushdb(): Promise<unknown> {
    return this.client.flushdb();
  }
}

class InMemoryStorageAdapter implements StorageAdapter {
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

  async flushdb(): Promise<unknown> {
    this.map.clear();
    return "OK";
  }
}

export class JobRepository {
  private readonly adapter: StorageAdapter;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  private key(jobId: string): string {
    return `job:${jobId}`;
  }

  async get(jobId: string): Promise<Job | null> {
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
    try {
      await this.adapter.set(this.key(jobId), JSON.stringify(jobData));
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error(`[JobRepository] failed to write job ${jobId}:`, cause);
      throw new JobRepositoryError(`Unable to persist job state for ${jobId}`, cause);
    }
  }

  async delete(jobId: string): Promise<boolean> {
    try {
      const result = await this.adapter.del(this.key(jobId));
      return result > 0;
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      logger.error(`[JobRepository] failed to delete job ${jobId}:`, cause);
      throw new JobRepositoryError(`Unable to delete job state for ${jobId}`, cause);
    }
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
}

export function createJobRepository(): JobRepository {
  if (process.env.NODE_ENV === "test") {
    return new JobRepository(new InMemoryStorageAdapter());
  }

  if (!process.env.REDIS_URL) {
    return new JobRepository(new InMemoryStorageAdapter());
  }

  const redis = new Redis(process.env.REDIS_URL);
  return new JobRepository(new RedisStorageAdapter(redis));
}
