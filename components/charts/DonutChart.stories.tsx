import type { Meta, StoryObj } from '@storybook/react';
import { DonutChart } from './DonutChart';

const meta: Meta<typeof DonutChart> = {
  title: 'Charts/DonutChart',
  component: DonutChart,
  tags: ['autodocs'],
  argTypes: {
    ariaLabel: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof DonutChart>;

export const Default: Story = {
  args: {
    ariaLabel: 'Platform revenue distribution',
    slices: [
      { label: 'YouTube', value: 55, color: '#FF0000' },
      { label: 'TikTok', value: 25, color: '#00E68A' },
      { label: 'Instagram', value: 20, color: '#E1306C' },
    ],
  },
};

export const TwoSlices: Story = {
  args: {
    ariaLabel: 'Fiat vs Crypto revenue',
    slices: [
      { label: 'Fiat', value: 70, color: '#00E68A' },
      { label: 'Crypto', value: 30, color: '#8B5CF6' },
    ],
  },
};

export const SingleDominant: Story = {
  args: {
    ariaLabel: 'Single platform revenue',
    slices: [
      { label: 'YouTube', value: 95, color: '#FF0000' },
      { label: 'Other', value: 5, color: '#374151' },
    ],
  },
};

export const EvenSplit: Story = {
  args: {
    ariaLabel: 'Even platform split',
    slices: [
      { label: 'YouTube', value: 25, color: '#FF0000' },
      { label: 'TikTok', value: 25, color: '#00E68A' },
      { label: 'Instagram', value: 25, color: '#E1306C' },
      { label: 'Twitter', value: 25, color: '#1DA1F2' },
    ],
  },
};
