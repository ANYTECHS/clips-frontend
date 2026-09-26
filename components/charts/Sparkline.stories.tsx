import type { Meta, StoryObj } from '@storybook/react';
import { Sparkline } from './Sparkline';

const meta: Meta<typeof Sparkline> = {
  title: 'Charts/Sparkline',
  component: Sparkline,
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'color' },
    ariaLabel: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Default: Story = {
  args: {
    values: [10, 25, 18, 40, 32, 55, 48, 70, 65, 85],
    ariaLabel: 'Revenue over time',
  },
};

export const Uptrend: Story = {
  args: {
    values: [5, 10, 15, 22, 30, 42, 55, 68, 80, 95],
    color: '#00E68A',
    ariaLabel: 'Rising revenue trend',
  },
};

export const Downtrend: Story = {
  args: {
    values: [95, 80, 68, 55, 42, 30, 22, 15, 10, 5],
    color: '#EF4444',
    ariaLabel: 'Declining revenue trend',
  },
};

export const Flat: Story = {
  args: {
    values: [50, 51, 49, 50, 52, 50, 49, 51, 50, 50],
    color: '#6B7280',
    ariaLabel: 'Stable revenue trend',
  },
};

export const Volatile: Story = {
  args: {
    values: [20, 80, 15, 90, 30, 75, 10, 95, 25, 60],
    ariaLabel: 'Volatile revenue pattern',
  },
};
