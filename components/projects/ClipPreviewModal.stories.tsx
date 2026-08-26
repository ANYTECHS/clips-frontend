import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import ClipPreviewModal from './ClipPreviewModal';
import type { Clip } from './ClipGrid';

const meta: Meta<typeof ClipPreviewModal> = {
  title: 'Projects/ClipPreviewModal',
  component: ClipPreviewModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onClose: { action: 'closed' },
  },
};

export default meta;
type Story = StoryObj<typeof ClipPreviewModal>;

const highScoreClip: Clip = {
  id: 'clip-001',
  title: 'Epic Gaming Moment — Boss Fight',
  thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1080&fit=crop',
  score: 92,
  scoreKey: 'high',
  duration: '0:32',
  style: 'Bold & Dynamic',
  status: 'ready',
  resolution: '1920x1080',
  videoUrl: '',
};

export const HighScore: Story = {
  args: {
    clip: highScoreClip,
    onClose: fn(),
  },
};

export const MediumScore: Story = {
  args: {
    clip: {
      ...highScoreClip,
      id: 'clip-002',
      title: 'Cooking Tutorial Highlight',
      thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1080&fit=crop',
      score: 63,
      scoreKey: 'medium',
      duration: '1:05',
      style: 'Minimalist',
    },
    onClose: fn(),
  },
};

export const LowScore: Story = {
  args: {
    clip: {
      ...highScoreClip,
      id: 'clip-003',
      title: 'Casual Vlog Moment',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&fit=crop',
      score: 28,
      scoreKey: 'low',
      duration: '0:15',
      style: 'Subtitles Only',
    },
    onClose: fn(),
  },
};

export const LongTitle: Story = {
  args: {
    clip: {
      ...highScoreClip,
      id: 'clip-004',
      title: 'An Extremely Long Clip Title That Tests How The Modal Handles Overflow In The Metadata Sidebar',
      score: 78,
      scoreKey: 'medium',
    },
    onClose: fn(),
  },
};
