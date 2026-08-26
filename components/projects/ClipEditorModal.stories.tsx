import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import ClipEditorModal from './ClipEditorModal';
import type { Clip } from './ClipGrid';

const meta: Meta<typeof ClipEditorModal> = {
  title: 'Projects/ClipEditorModal',
  component: ClipEditorModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onClose: { action: 'closed' },
    onSave: { action: 'saved' },
  },
};

export default meta;
type Story = StoryObj<typeof ClipEditorModal>;

const mockClip: Clip = {
  id: 'clip-001',
  title: 'Epic Gaming Moment',
  thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
  score: 87,
  scoreKey: 'high',
  duration: '0:32',
  style: 'Bold & Dynamic',
  status: 'ready',
  resolution: '1920x1080',
  videoUrl: '',
};

export const Default: Story = {
  args: {
    clip: mockClip,
    onClose: fn(),
    onSave: fn(),
  },
};

export const VerticalClip: Story = {
  args: {
    clip: {
      ...mockClip,
      id: 'clip-002',
      title: 'Short-form Vertical Content',
      resolution: '1080x1920',
    },
    onClose: fn(),
    onSave: fn(),
  },
};

export const MinimalistStyle: Story = {
  args: {
    clip: {
      ...mockClip,
      id: 'clip-003',
      title: 'Cooking Tutorial Highlight',
      thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=450&fit=crop',
      style: 'Minimalist',
    },
    onClose: fn(),
    onSave: fn(),
  },
};
