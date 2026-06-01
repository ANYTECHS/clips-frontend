import type { Meta, StoryObj } from '@storybook/react';
import ProjectCard from './ProjectCard';

const meta = {
  title: 'Dashboard/ProjectCard',
  component: ProjectCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Project title',
    },
    clipsCount: {
      control: 'number',
      description: 'Number of clips generated',
    },
    status: {
      control: 'select',
      options: ['processing', 'completed'],
      description: 'Project status',
    },
    thumbnail: {
      control: 'text',
      description: 'Thumbnail image URL',
    },
  },
} satisfies Meta<typeof ProjectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Processing: Story = {
  args: {
    title: 'Apex Legends Clutch Moments',
    clipsCount: 2,
    status: 'processing',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  },
};

export const Completed: Story = {
  args: {
    title: 'React Native Tutorial 2024',
    clipsCount: 12,
    status: 'completed',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=400&fit=crop',
  },
};

export const PodcastHighlight: Story = {
  args: {
    title: 'Weekly Podcast Highlight #42',
    clipsCount: 5,
    status: 'completed',
    thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop',
  },
};

export const LongTitle: Story = {
  args: {
    title: 'This is a Very Long Project Title That Should Be Truncated Properly',
    clipsCount: 8,
    status: 'processing',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop',
  },
};

export const SingleClip: Story = {
  args: {
    title: 'Quick Tutorial',
    clipsCount: 1,
    status: 'completed',
    thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=400&fit=crop',
  },
};

export const ManyClips: Story = {
  args: {
    title: 'Full Course Recording',
    clipsCount: 47,
    status: 'completed',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=400&fit=crop',
  },
};
