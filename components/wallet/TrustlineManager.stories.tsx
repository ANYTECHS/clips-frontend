import type { Meta, StoryObj } from '@storybook/react';
import { TrustlineManager } from './TrustlineManager';

const meta: Meta<typeof TrustlineManager> = {
  title: 'Wallet/TrustlineManager',
  component: TrustlineManager,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TrustlineManager>;

export const Default: Story = {
  args: {
    hasTrustline: false,
    assetCode: 'USDC',
    isLoading: false,
  },
};

export const Active: Story = {
  args: {
    hasTrustline: true,
    assetCode: 'USDC',
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    hasTrustline: false,
    assetCode: 'USDC',
    isLoading: true,
  },
};
