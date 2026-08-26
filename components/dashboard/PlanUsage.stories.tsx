import type { Meta, StoryObj } from '@storybook/react';
import PlanUsage from './PlanUsage';
import { useUserStore } from '@/app/store/userStore';

const meta: Meta<typeof PlanUsage> = {
  title: 'Dashboard/PlanUsage',
  component: PlanUsage,
  tags: ['autodocs'],
  argTypes: {
    compact: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof PlanUsage>;

export const FreePlanLowUsage: Story = {
  name: 'Free Plan — Low Usage',
  args: {
    compact: false,
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-001',
          name: 'John Doe',
          email: 'john@example.com',
          avatarUrl: null,
          plan: 'free',
          planUsagePercent: 30,
          transformQuotaRemaining: 7,
        },
      });
      return <Story />;
    },
  ],
};

export const ProPlanMediumUsage: Story = {
  name: 'Pro Plan — Medium Usage',
  args: {
    compact: false,
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-002',
          name: 'Jane Smith',
          email: 'jane@example.com',
          avatarUrl: null,
          plan: 'pro',
          planUsagePercent: 65,
          transformQuotaRemaining: 35,
        },
      });
      return <Story />;
    },
  ],
};

export const ProPlanHighUsage: Story = {
  name: 'Pro Plan — High Usage (>90%)',
  args: {
    compact: false,
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-003',
          name: 'Alice Brown',
          email: 'alice@example.com',
          avatarUrl: null,
          plan: 'pro',
          planUsagePercent: 95,
          transformQuotaRemaining: 5,
        },
      });
      return <Story />;
    },
  ],
};

export const EnterpriseLowUsage: Story = {
  name: 'Enterprise Plan — Low Usage',
  args: {
    compact: false,
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-004',
          name: 'Bob Enterprise',
          email: 'bob@corp.com',
          avatarUrl: null,
          plan: 'enterprise',
          planUsagePercent: 12,
          transformQuotaRemaining: 880,
        },
      });
      return <Story />;
    },
  ],
};

export const CompactView: Story = {
  args: {
    compact: true,
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-005',
          name: 'Compact User',
          email: 'compact@example.com',
          avatarUrl: null,
          plan: 'free',
          planUsagePercent: 50,
          transformQuotaRemaining: 5,
        },
      });
      return <Story />;
    },
  ],
};
