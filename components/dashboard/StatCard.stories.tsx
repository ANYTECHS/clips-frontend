import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Dashboard/StatCard',
  component: StatCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    title: 'Total Earnings',
    value: '$1,250.00',
    change: '+12.5%',
    trend: 'up',
  },
};

export const Loading: Story = {
  args: {
    title: 'Total Earnings',
    value: '',
    isLoading: true,
  },
};

export const NegativeTrend: Story = {
  args: {
    title: 'Active Users',
    value: '3,210',
    change: '-4.3%',
    trend: 'down',
  },
};
