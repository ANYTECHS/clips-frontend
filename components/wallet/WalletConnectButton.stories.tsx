import type { Meta, StoryObj } from '@storybook/react';
import { WalletConnectButton } from './WalletConnectButton';

const meta: Meta<typeof WalletConnectButton> = {
  title: 'Wallet/WalletConnectButton',
  component: WalletConnectButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WalletConnectButton>;

export const Disconnected: Story = {
  args: {
    isConnected: false,
    label: 'Connect Wallet',
  },
};

export const Connecting: Story = {
  args: {
    isConnected: false,
    isLoading: true,
    label: 'Connecting...',
  },
};

export const Connected: Story = {
  args: {
    isConnected: true,
    address: 'G...42xl',
    label: 'Disconnect',
  },
};
