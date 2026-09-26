import type { Meta, StoryObj } from '@storybook/react';
import RevenueChart from './RevenueChart';

const meta: Meta<typeof RevenueChart> = {
  title: 'Dashboard/RevenueChart',
  component: RevenueChart,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Placeholder component — not yet implemented.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RevenueChart>;

export const Default: Story = {};
