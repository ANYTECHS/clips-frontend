import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import ClipComparisonView from './ClipComparisonView';
import type { Clip } from './ClipGrid';

const meta: Meta<typeof ClipComparisonView> = {
  title: 'Projects/ClipComparisonView',
  component: ClipComparisonView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    onClose: { action: 'closed' },
    onSelectWinner: { action: 'selectedWinner' },
  },
};

export default meta;
type Story = StoryObj<typeof ClipComparisonView>;

const sampleClips: Clip[] = [
  {
    id: 'clip-001',
    title: 'Epic Gaming Moment — Boss Fight',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1080&fit=crop',
    score: 92,
    scoreKey: 'high',
    duration: '0:32',
    style: 'Bold & Dynamic',
    status: 'ready',
    resolution: '1080x1920',
    videoUrl: '',
  },
  {
    id: 'clip-002',
    title: 'Cooking Tutorial Highlight',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1080&fit=crop',
    score: 84,
    scoreKey: 'high',
    duration: '0:45',
    style: 'Minimalist',
    status: 'ready',
    resolution: '1080x1920',
    videoUrl: '',
  },
  {
    id: 'clip-003',
    title: 'Tech Review — Final Verdict',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&fit=crop',
    score: 79,
    scoreKey: 'medium',
    duration: '0:38',
    style: 'Emoji-Rich',
    status: 'ready',
    resolution: '1080x1920',
    videoUrl: '',
  },
  {
    id: 'clip-004',
    title: 'Podcast Teaser — AI Future',
    thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1080&fit=crop',
    score: 88,
    scoreKey: 'high',
    duration: '0:30',
    style: 'Subtitles Only',
    status: 'ready',
    resolution: '1080x1920',
    videoUrl: '',
  },
];

export const TwoClips: Story = {
  args: {
    clips: sampleClips.slice(0, 2),
    onClose: fn(),
    onSelectWinner: fn(),
  },
};

export const ThreeClips: Story = {
  args: {
    clips: sampleClips.slice(0, 3),
    onClose: fn(),
    onSelectWinner: fn(),
  },
};

export const FourClips: Story = {
  args: {
    clips: sampleClips,
    onClose: fn(),
    onSelectWinner: fn(),
  },
};
