import type { Meta, StoryObj } from '@storybook/react';
import EarningsSummaryCards from './EarningsSummaryCards';
import { useEarningsStore } from '@/app/store/earningsStore';

const meta: Meta<typeof EarningsSummaryCards> = {
  title: 'Dashboard/EarningsSummaryCards',
  component: EarningsSummaryCards,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EarningsSummaryCards>;

export const Default: Story = {
  decorators: [
    (Story) => {
      useEarningsStore.setState({
        totalFiat: { value: '$3,240.00', change: 12.5 },
        cryptoRevenue: { value: '0.84 ETH', change: 8.3 },
        pendingPayouts: { value: '$420.00', change: -2.1 },
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const NegativeTrends: Story = {
  decorators: [
    (Story) => {
      useEarningsStore.setState({
        totalFiat: { value: '$1,800.00', change: -15.0 },
        cryptoRevenue: { value: '0.22 ETH', change: -7.4 },
        pendingPayouts: { value: '$90.00', change: -30.2 },
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const SteadyTrend: Story = {
  decorators: [
    (Story) => {
      useEarningsStore.setState({
        totalFiat: { value: '$2,500.00', change: 0 },
        cryptoRevenue: { value: '0.50 ETH', change: 0 },
        pendingPayouts: { value: '$0.00', change: 0 },
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      useEarningsStore.setState({
        totalFiat: { value: '$0.00', change: 0 },
        cryptoRevenue: { value: '0.00 ETH', change: 0 },
        pendingPayouts: { value: '$0.00', change: 0 },
        loading: true,
        error: null,
      });
      return <Story />;
    },
  ],
};
