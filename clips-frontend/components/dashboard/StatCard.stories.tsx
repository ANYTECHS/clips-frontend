import type { Meta, StoryObj } from '@storybook/react';
import StatCard from './StatCard';
import { DollarSign, Video, Globe, TrendingUp, Users, Clock } from 'lucide-react';

const meta = {
  title: 'Dashboard/StatCard',
  component: StatCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'The label text displayed at the top of the card',
    },
    value: {
      control: 'text',
      description: 'The main value to display (can be number or text)',
    },
    trend: {
      control: 'text',
      description: 'The trend indicator text',
    },
    isPositive: {
      control: 'boolean',
      description: 'Whether the trend is positive (green) or negative (red)',
    },
    hideTrendIcon: {
      control: 'boolean',
      description: 'Hide the trending up/down icon',
    },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TotalEarnings: Story = {
  args: {
    label: 'Total Earnings',
    value: '$12,450.80',
    trend: '+12.5%',
    isPositive: true,
    icon: DollarSign,
  },
};

export const ClipsPosted: Story = {
  args: {
    label: 'Clips Posted',
    value: '142',
    trend: '+8.2%',
    isPositive: true,
    icon: Video,
  },
};

export const ActivePlatforms: Story = {
  args: {
    label: 'Active Platforms',
    value: '4',
    trend: 'Steady',
    isPositive: true,
    icon: Globe,
    hideTrendIcon: true,
  },
};

export const NegativeTrend: Story = {
  args: {
    label: 'Engagement Rate',
    value: '3.2%',
    trend: '-2.1%',
    isPositive: false,
    icon: TrendingUp,
  },
};

export const TotalUsers: Story = {
  args: {
    label: 'Total Users',
    value: '1,234',
    trend: '+45.2%',
    isPositive: true,
    icon: Users,
  },
};

export const ProcessingTime: Story = {
  args: {
    label: 'Avg Processing Time',
    value: '2.5 min',
    trend: '-15%',
    isPositive: true,
    icon: Clock,
  },
};

export const LargeValue: Story = {
  args: {
    label: 'Total Revenue',
    value: '$1,234,567.89',
    trend: '+234.5%',
    isPositive: true,
    icon: DollarSign,
  },
};
