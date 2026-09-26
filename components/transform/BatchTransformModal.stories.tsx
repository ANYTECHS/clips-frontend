import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { BatchTransformModal } from './BatchTransformModal';

const meta: Meta<typeof BatchTransformModal> = {
  title: 'Transform/BatchTransformModal',
  component: BatchTransformModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onConfirm: { action: 'confirmed' },
    onClose: { action: 'closed' },
    isSubmitting: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof BatchTransformModal>;

export const SingleClip: Story = {
  name: 'Single Clip',
  args: {
    clipCount: 1,
    previewClipId: 'clip-abc-123',
    isSubmitting: false,
    submitError: null,
    onConfirm: fn(),
    onClose: fn(),
  },
};

export const BatchThree: Story = {
  name: 'Batch — 3 Clips',
  args: {
    clipCount: 3,
    previewClipId: null,
    isSubmitting: false,
    submitError: null,
    onConfirm: fn(),
    onClose: fn(),
  },
};

export const BatchTen: Story = {
  name: 'Batch — 10 Clips',
  args: {
    clipCount: 10,
    previewClipId: null,
    isSubmitting: false,
    submitError: null,
    onConfirm: fn(),
    onClose: fn(),
  },
};

export const Submitting: Story = {
  args: {
    clipCount: 5,
    previewClipId: null,
    isSubmitting: true,
    submitError: null,
    onConfirm: fn(),
    onClose: fn(),
  },
};

export const WithError: Story = {
  args: {
    clipCount: 3,
    previewClipId: null,
    isSubmitting: false,
    submitError: 'Failed to start batch transform. Please try again.',
    onConfirm: fn(),
    onClose: fn(),
  },
};
