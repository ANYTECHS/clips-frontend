import { JobRepository, JobRepositoryError } from './jobRepository';
import { logger } from '@/app/lib/logger';

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis client
jest.mock('./redisClient', () => ({
  getRedisClient: jest.fn(() => null),
  isRedisAvailable: jest.fn(() => false),
  checkRedisHealth: jest.fn(() => Promise.resolve(false)),
}));

type Job = {
  id: string;
  userId: string;
  status: string;
  progress: number;
  momentsFound: number;
  estimatedSecondsRemaining: number;
  createdAt: number;
};

describe('JobRepository', () => {
  const sampleJob: Job = {
    id: 'job-1',
    userId: 'user-1',
    status: 'processing',
    progress: 42,
    momentsFound: 3,
    estimatedSecondsRemaining: 120,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('set() serializes and calls adapter.set', async () => {
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const repo = new JobRepository(mockAdapter as any);
    await repo.set(sampleJob.id, sampleJob as any);

    expect(mockAdapter.set).toHaveBeenCalledTimes(1);
    const [key, value] = mockAdapter.set.mock.calls[0];
    expect(key).toBe(`job:${sampleJob.id}`);
    expect(typeof value).toBe('string');
    expect(JSON.parse(value)).toEqual(sampleJob);
  });

  test('get() parses stored JSON into Job', async () => {
    const serialized = JSON.stringify(sampleJob);
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(serialized),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const repo = new JobRepository(mockAdapter as any);
    const out = await repo.get(sampleJob.id);
    expect(mockAdapter.get).toHaveBeenCalledWith(`job:${sampleJob.id}`);
    expect(out).toEqual(sampleJob);
  });

  test('delete() returns true when adapter.del > 0', async () => {
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const repo = new JobRepository(mockAdapter as any);
    const deleted = await repo.delete(sampleJob.id);
    expect(deleted).toBe(true);
    expect(mockAdapter.del).toHaveBeenCalledWith(`job:${sampleJob.id}`);
  });

  test('get() throws JobRepositoryError on underlying adapter failure', async () => {
    const mockAdapter = {
      get: jest.fn().mockRejectedValue(new Error('network')),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
    };

    const repo = new JobRepository(mockAdapter as any);

    await expect(repo.get(sampleJob.id)).rejects.toBeInstanceOf(JobRepositoryError);
  });

  test('set() logs error and throws JobRepositoryError on failure', async () => {
    const error = new Error('Redis connection failed');
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockRejectedValue(error),
      del: jest.fn().mockResolvedValue(0),
    };

    const repo = new JobRepository(mockAdapter as any);

    await expect(repo.set(sampleJob.id, sampleJob as any))
      .rejects.toBeInstanceOf(JobRepositoryError);
    
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to write job'),
      error
    );
  });

  test('delete() logs error and throws JobRepositoryError on failure', async () => {
    const error = new Error('Redis connection failed');
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockRejectedValue(error),
    };

    const repo = new JobRepository(mockAdapter as any);

    await expect(repo.delete(sampleJob.id))
      .rejects.toBeInstanceOf(JobRepositoryError);
    
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to delete job'),
      error
    );
  });

  test('getAll() returns empty array when adapter has no getAll method', async () => {
    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const repo = new JobRepository(mockAdapter as any);
    const jobs = await repo.getAll();
    
    expect(jobs).toEqual([]);
  });

  test('getUserJobs() filters jobs by userId', async () => {
    const jobs = [
      { ...sampleJob, id: 'job-1', userId: 'user-1' },
      { ...sampleJob, id: 'job-2', userId: 'user-2' },
      { ...sampleJob, id: 'job-3', userId: 'user-1' },
    ];

    const mockAdapter = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      getAll: jest.fn().mockResolvedValue(jobs.map(j => JSON.stringify(j))),
    };

    const repo = new JobRepository(mockAdapter as any);
    const userJobs = await repo.getUserJobs('user-1');
    
    expect(userJobs).toHaveLength(2);
    expect(userJobs.every(j => j.userId === 'user-1')).toBe(true);
  });
});
