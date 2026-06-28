import type { Meta, StoryObj } from '@storybook/react';
import { EarningsTable } from './EarningsTable';

const meta: Meta<typeof EarningsTable> = {
  title: 'Dashboard/EarningsTable',
  component: EarningsTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EarningsTable>;

const mockData = [
  { id: '1', date: '2026-06-01', source: 'Clip Views', amount: '$45.00' },
  { id: '2', date: '2026-06-02', source: 'Tips', amount: '$20.00' },
  { id: '3', date: '2026-06-03', source: 'Subscription', amount: '$150.00' },
];

export const Default: Story = {
  args: {
    data: mockData,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    data: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    isLoading: false,
  },
};
