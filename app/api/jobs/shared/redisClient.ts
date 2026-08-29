/**
 * Redis Client with Connection Pooling and Health Monitoring
 * 
 * Provides a singleton Redis client with:
 * - Connection pooling for better performance
 * - Health checks and automatic reconnection
 * - Fallback to in-memory storage on failure
 * - Connection metrics and monitoring
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger } from '@/app/lib/logger';

// Connection pool configuration
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '3', 10);
const REDIS_RETRY_DELAY = parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10);
const REDIS_CONNECT_TIMEOUT = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10);
const REDIS_COMMAND_TIMEOUT = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10);
const REDIS_KEEP_ALIVE = parseInt(process.env.REDIS_KEEP_ALIVE || '30000', 10);
const REDIS_MAX_RECONNECT_ATTEMPTS = parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || '10', 10);

interface RedisHealthMetrics {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  uptime: number;
  lastError?: string;
  reconnectAttempts: number;
  isHealthy: boolean;
  timestamp: string;
}

class RedisClientManager {
  private client: Redis | null = null;
  private isProduction = process.env.NODE_ENV === 'production';
  private reconnectAttempts = 0;
  private lastError: string | undefined;
  private startTime = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const redisUrl = process.env.REDIS_URL;

    // In test mode, don't create a real Redis connection
    if (process.env.NODE_ENV === 'test') {
      logger.debug('[Redis] Running in test mode - Redis client not initialized');
      return;
    }

    // If no Redis URL in production, log warning
    if (this.isProduction && !redisUrl) {
      logger.warn(
        '[Redis] REDIS_URL not configured in production. Job state will not persist across serverless instances. ' +
        'This will cause state inconsistency in distributed environments.'
      );
      return;
    }

    // If no Redis URL in development, use in-memory storage
    if (!redisUrl) {
      logger.info('[Redis] REDIS_URL not configured - using in-memory storage');
      return;
    }

    this.createClient(redisUrl);
    this.setupHealthCheck();
  }

  private createClient(url: string): void {
    const options: RedisOptions = {
      // Connection settings
      connectTimeout: REDIS_CONNECT_TIMEOUT,
      commandTimeout: REDIS_COMMAND_TIMEOUT,
      keepAlive: REDIS_KEEP_ALIVE,
      
      // Retry strategy
      retryStrategy: (times: number) => {
        if (times > REDIS_MAX_RECONNECT_ATTEMPTS) {
          logger.error('[Redis] Max reconnection attempts reached. Falling back to in-memory storage.');
          return null; // Stop retrying
        }

        const delay = Math.min(times * REDIS_RETRY_DELAY, 10000);
        logger.warn(`[Redis] Reconnection attempt ${times}/${REDIS_MAX_RECONNECT_ATTEMPTS}, retrying in ${delay}ms`);
        this.reconnectAttempts = times;
        return delay;
      },

      // Reconnect on error
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        const shouldReconnect = targetErrors.some(target => err.message.includes(target));
        
        if (shouldReconnect) {
          logger.warn('[Redis] Reconnecting due to error:', err.message);
          return true;
        }
        
        return false;
      },

      // Enable offline queue to buffer commands when disconnected
      enableOfflineQueue: true,
      
      // Max commands to queue while offline
      maxRetriesPerRequest: REDIS_MAX_RETRIES,

      // Lazy connect - don't block on connection
      lazyConnect: false,

      // Show friendly error stack traces
      showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
    };

    try {
      this.client = new Redis(url, options);
      this.setupEventListeners();
      logger.info('[Redis] Client initialized with connection pooling');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      logger.error('[Redis] Failed to create client:', error);
      this.client = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('[Redis] Connected successfully');
      this.reconnectAttempts = 0;
      this.lastError = undefined;
    });

    this.client.on('ready', () => {
      logger.info('[Redis] Client ready to accept commands');
    });

    this.client.on('error', (error: Error) => {
      this.lastError = error.message;
      logger.error('[Redis] Connection error:', error);
    });

    this.client.on('close', () => {
      logger.warn('[Redis] Connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('[Redis] Attempting to reconnect...');
    });

    this.client.on('end', () => {
      logger.warn('[Redis] Connection ended - no more reconnection attempts');
    });
  }

  private setupHealthCheck(): void {
    // Periodic health check every 30 seconds
    const interval = parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000', 10);
    
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getHealthMetrics();
      
      if (!health.isHealthy) {
        logger.warn('[Redis] Health check failed:', health);
      }
    }, interval);

    // Cleanup on process termination
    const cleanup = () => {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      this.disconnect();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  /**
   * Get the Redis client instance
   * Returns null if Redis is not available (fallback to in-memory)
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Check if Redis is available and connected
   */
  isAvailable(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * Perform a health check by pinging Redis
   */
  async checkHealth(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      logger.error('[Redis] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed health metrics
   */
  async getHealthMetrics(): Promise<RedisHealthMetrics> {
    const isHealthy = await this.checkHealth();
    const status = this.client?.status || 'disconnected';

    return {
      status: status as RedisHealthMetrics['status'],
      uptime: Date.now() - this.startTime,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      isHealthy,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get connection pool info
   */
  async getPoolInfo(): Promise<{
    connectedClients: number;
    usedMemory: string;
    uptimeSeconds: number;
  } | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const info = await this.client!.info('stats');
      const lines = info.split('\r\n');
      const stats: Record<string, string> = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      }

      return {
        connectedClients: parseInt(stats.connected_clients || '0', 10),
        usedMemory: stats.used_memory_human || '0',
        uptimeSeconds: parseInt(stats.uptime_in_seconds || '0', 10),
      };
    } catch (error) {
      logger.error('[Redis] Failed to get pool info:', error);
      return null;
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('[Redis] Disconnected successfully');
      } catch (error) {
        logger.error('[Redis] Error during disconnect:', error);
        // Force disconnect if graceful quit fails
        this.client.disconnect();
      }
      this.client = null;
    }
  }

  /**
   * Force reconnection (useful for recovery scenarios)
   */
  async reconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        await this.client.connect();
        logger.info('[Redis] Manual reconnection successful');
      } catch (error) {
        logger.error('[Redis] Manual reconnection failed:', error);
        throw error;
      }
    }
  }
}

// Singleton instance
const redisManager = new RedisClientManager();

export const getRedisClient = () => redisManager.getClient();
export const isRedisAvailable = () => redisManager.isAvailable();
export const checkRedisHealth = () => redisManager.checkHealth();
export const getRedisHealthMetrics = () => redisManager.getHealthMetrics();
export const getRedisPoolInfo = () => redisManager.getPoolInfo();
export const disconnectRedis = () => redisManager.disconnect();
export const reconnectRedis = () => redisManager.reconnect();
