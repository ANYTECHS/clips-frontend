import type { Meta, StoryObj } from '@storybook/react';
import ClipCard from './ClipCard';

const meta = {
  title: 'Projects/ClipCard',
  component: ClipCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onSelect: () => {},
    onEdit: () => {},
    onDownload: () => {},
    onPreview: () => {},
  },
  argTypes: {
    score: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'AI score from 0 to 100',
    },
    isSelected: {
      control: 'boolean',
      description: 'Whether the clip is selected',
    },
    isRecommended: {
      control: 'boolean',
      description: 'Whether the clip is AI recommended',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClipCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighScore: Story = {
  args: {
    id: '1',
    title: 'Epic Gaming Moment - Triple Kill',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=400&fit=crop',
    score: 95,
    duration: '0:45',
    isSelected: false,
    isRecommended: false,
  },
};

export const MediumScore: Story = {
  args: {
    id: '2',
    title: 'Tutorial: React Hooks Explained',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop',
    score: 75,
    duration: '2:15',
    isSelected: false,
    isRecommended: false,
  },
};

export const LowScore: Story = {
  args: {
    id: '3',
    title: 'Daily Vlog Entry',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=400&fit=crop',
    score: 45,
    duration: '1:30',
    isSelected: false,
    isRecommended: false,
  },
};

export const Selected: Story = {
  args: {
    id: '4',
    title: 'Funny Cat Compilation',
    thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop',
    score: 88,
    duration: '1:00',
    isSelected: true,
    isRecommended: false,
  },
};

export const Recommended: Story = {
  args: {
    id: '5',
    title: 'AI Recommended Clip - High Engagement',
    thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop',
    score: 92,
    duration: '0:30',
    isSelected: false,
    isRecommended: true,
  },
};

export const RecommendedAndSelected: Story = {
  args: {
    id: '6',
    title: 'Perfect Viral Moment',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=400&fit=crop',
    score: 98,
    duration: '0:15',
    isSelected: true,
    isRecommended: true,
  },
};

export const LongTitle: Story = {
  args: {
    id: '7',
    title: 'This is a Very Long Clip Title That Should Wrap Properly on Multiple Lines',
    thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop',
    score: 82,
    duration: '3:45',
    isSelected: false,
    isRecommended: false,
  },
};

export const ShortDuration: Story = {
  args: {
    id: '8',
    title: 'Quick Tip',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop',
    score: 90,
    duration: '0:08',
    isSelected: false,
    isRecommended: false,
  },
};

export const LongDuration: Story = {
  args: {
    id: '9',
    title: 'Full Tutorial Series',
    thumbnail: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop',
    score: 78,
    duration: '12:34',
    isSelected: false,
    isRecommended: false,
  },
};
