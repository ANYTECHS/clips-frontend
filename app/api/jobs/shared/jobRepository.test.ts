import { JobRepository, JobRepositoryError } from './jobRepository';

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
});
