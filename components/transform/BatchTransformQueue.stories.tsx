import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { BatchTransformQueue } from './BatchTransformQueue';
import type { BatchTransformState } from '@/app/store/types';

const meta: Meta<typeof BatchTransformQueue> = {
  title: 'Transform/BatchTransformQueue',
  component: BatchTransformQueue,
  tags: ['autodocs'],
  argTypes: {
    onCancelJob: { action: 'job_cancelled' },
    onDismiss: { action: 'dismissed' },
  },
};

export default meta;
type Story = StoryObj<typeof BatchTransformQueue>;

const inProgressBatch: BatchTransformState = {
  batchId: 'batch-001',
  style: 'anime',
  createdAt: new Date().toISOString(),
  jobs: {
    'job-1': { jobId: 'job-1', clipId: 'clip-001', status: 'complete',    progress: 100, resultUrl: '/output/clip-001.mp4' },
    'job-2': { jobId: 'job-2', clipId: 'clip-002', status: 'processing',  progress: 65,  resultUrl: null },
    'job-3': { jobId: 'job-3', clipId: 'clip-003', status: 'queued',      progress: 0,   resultUrl: null },
    'job-4': { jobId: 'job-4', clipId: 'clip-004', status: 'queued',      progress: 0,   resultUrl: null },
  },
};

const completedBatch: BatchTransformState = {
  batchId: 'batch-002',
  style: 'cinematic',
  createdAt: new Date().toISOString(),
  jobs: {
    'job-1': { jobId: 'job-1', clipId: 'clip-001', status: 'complete',  progress: 100, resultUrl: '/output/clip-001.mp4' },
    'job-2': { jobId: 'job-2', clipId: 'clip-002', status: 'complete',  progress: 100, resultUrl: '/output/clip-002.mp4' },
    'job-3': { jobId: 'job-3', clipId: 'clip-003', status: 'complete',  progress: 100, resultUrl: '/output/clip-003.mp4' },
  },
};

const errorBatch: BatchTransformState = {
  batchId: 'batch-003',
  style: 'retro-vhs',
  createdAt: new Date().toISOString(),
  jobs: {
    'job-1': { jobId: 'job-1', clipId: 'clip-001', status: 'complete',   progress: 100, resultUrl: '/output/clip-001.mp4' },
    'job-2': { jobId: 'job-2', clipId: 'clip-002', status: 'error',      progress: 40,  resultUrl: null, errorMessage: 'GPU out of memory. Retry the job.' },
    'job-3': { jobId: 'job-3', clipId: 'clip-003', status: 'cancelled',  progress: 0,   resultUrl: null },
  },
};

export const InProgress: Story = {
  args: {
    batch: inProgressBatch,
    completedCount: 1,
    totalCount: 4,
    onCancelJob: fn(),
    onDismiss: fn(),
  },
};

export const AllComplete: Story = {
  args: {
    batch: completedBatch,
    completedCount: 3,
    totalCount: 3,
    onCancelJob: fn(),
    onDismiss: fn(),
  },
};

export const WithErrors: Story = {
  args: {
    batch: errorBatch,
    completedCount: 3,
    totalCount: 3,
    onCancelJob: fn(),
    onDismiss: fn(),
  },
};

export const SingleJob: Story = {
  args: {
    batch: {
      batchId: 'batch-single',
      style: 'sketch',
      createdAt: new Date().toISOString(),
      jobs: {
        'job-1': { jobId: 'job-1', clipId: 'clip-001', status: 'processing', progress: 42, resultUrl: null },
      },
    },
    completedCount: 0,
    totalCount: 1,
    onCancelJob: fn(),
    onDismiss: fn(),
  },
};
