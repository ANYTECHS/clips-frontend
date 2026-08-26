import type { Meta, StoryObj } from '@storybook/react';
import ProjectCard from './ProjectCard';

const meta: Meta<typeof ProjectCard> = {
  title: 'Dashboard/ProjectCard',
  component: ProjectCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

export const Default: Story = {
  args: {
    title: 'Summer Vlog Highlights',
    clipsCount: 12,
    status: 'Completed',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop',
  },
};

export const Processing: Story = {
  args: {
    title: 'Gaming Stream Compilation',
    clipsCount: 0,
    status: 'Processing',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  },
};

export const ManyClips: Story = {
  args: {
    title: 'Travel Documentary Series',
    clipsCount: 248,
    status: 'Completed',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
  },
};

export const LongTitle: Story = {
  args: {
    title: 'An Extremely Long Project Title That Will Be Truncated By The Component',
    clipsCount: 5,
    status: 'Completed',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
  },
};
