import type { Meta, StoryObj } from '@storybook/react';
import EarningsTable from './EarningsTable';
import type { EarningTransaction, EarningsSummary } from '@/app/api/earnings/types';

const meta: Meta<typeof EarningsTable> = {
  title: 'Dashboard/EarningsTable',
  component: EarningsTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EarningsTable>;

const mockTransactions: EarningTransaction[] = [
  {
    id: 'TX-00001',
    date: '2026-06-01',
    description: 'YouTube payout #1',
    amount: 45.00,
    platform: 'YouTube',
    type: 'payout',
    status: 'completed',
    taxId: 'TAX-001',
  },
  {
    id: 'TX-00002',
    date: '2026-06-02',
    description: 'TikTok royalty #2',
    amount: 20.50,
    cryptoAmount: 0.0103,
    cryptoCurrency: 'ETH',
    platform: 'TikTok',
    type: 'royalty',
    status: 'pending',
    taxId: 'TAX-002',
  },
  {
    id: 'TX-00003',
    date: '2026-06-03',
    description: 'Instagram referral #3',
    amount: 150.00,
    platform: 'Instagram',
    type: 'referral',
    status: 'completed',
    taxId: 'TAX-003',
  },
];

const mockSummary: EarningsSummary = {
  total: '215.50',
  completed: '195.00',
  pending: '20.50',
};

export const Default: Story = {
  args: {
    transactions: mockTransactions,
    summary: mockSummary,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    transactions: [],
    summary: { total: '0.00', completed: '0.00', pending: '0.00' },
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    transactions: [],
    summary: { total: '0.00', completed: '0.00', pending: '0.00' },
    loading: false,
  },
};

export const WithPagination: Story = {
  args: {
    transactions: mockTransactions,
    summary: mockSummary,
    loading: false,
    pagination: { page: 1, pageSize: 3, total: 55, totalPages: 19 },
    onPageChange: () => {},
  },
};
