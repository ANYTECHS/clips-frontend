import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import DashboardHeader from './DashboardHeader';
import { useUserStore } from '@/app/store/userStore';

const meta: Meta<typeof DashboardHeader> = {
  title: 'Dashboard/DashboardHeader',
  component: DashboardHeader,
  tags: ['autodocs'],
  argTypes: {
    onMenuClick: { action: 'menu_clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof DashboardHeader>;

export const FreePlan: Story = {
  args: {
    onMenuClick: fn(),
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-001',
          name: 'Alex',
          email: 'alex@example.com',
          avatarUrl: null,
          plan: 'free',
          planUsagePercent: 40,
          transformQuotaRemaining: 6,
        },
      });
      return <Story />;
    },
  ],
};

export const ProPlan: Story = {
  args: {
    onMenuClick: fn(),
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-002',
          name: 'Jordan',
          email: 'jordan@example.com',
          avatarUrl: null,
          plan: 'pro',
          planUsagePercent: 75,
          transformQuotaRemaining: 25,
        },
      });
      return <Story />;
    },
  ],
};

export const NearQuotaLimit: Story = {
  name: 'Near Quota Limit',
  args: {
    onMenuClick: fn(),
  },
  decorators: [
    (Story) => {
      useUserStore.setState({
        profile: {
          id: 'user-003',
          name: 'Sam',
          email: 'sam@example.com',
          avatarUrl: null,
          plan: 'free',
          planUsagePercent: 92,
          transformQuotaRemaining: 1,
        },
      });
      return <Story />;
    },
  ],
};
