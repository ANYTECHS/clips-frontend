import type { Meta, StoryObj } from '@storybook/react';
import AIInsightCard from './AIInsightCard';

const meta = {
  title: 'Dashboard/AIInsightCard',
  component: AIInsightCard,
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AIInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InDashboard: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
};
