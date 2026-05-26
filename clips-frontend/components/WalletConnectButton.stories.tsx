import type { Meta, StoryObj } from '@storybook/react';
import WalletConnectButton from './WalletConnectButton';

// Mock the WalletProvider context
const mockWalletContext = {
  isConnected: false,
  isConnecting: false,
  address: null,
  error: null,
  connectMetaMask: async () => {},
  disconnect: () => {},
  clearError: () => {},
};

const meta = {
  title: 'Wallet/WalletConnectButton',
  component: WalletConnectButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean',
      description: 'Compact mode for headers/navbars',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WalletConnectButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  args: {
    compact: false,
  },
};

export const DisconnectedCompact: Story = {
  args: {
    compact: true,
  },
};

export const Connected: Story = {
  render: (args) => {
    // This would need proper mocking in a real scenario
    return <WalletConnectButton {...args} />;
  },
  args: {
    compact: false,
  },
};

export const ConnectedCompact: Story = {
  render: (args) => {
    return <WalletConnectButton {...args} />;
  },
  args: {
    compact: true,
  },
};

export const Loading: Story = {
  render: (args) => {
    return <WalletConnectButton {...args} />;
  },
  args: {
    compact: false,
  },
};

export const WithError: Story = {
  render: (args) => {
    return <WalletConnectButton {...args} />;
  },
  args: {
    compact: false,
  },
};
