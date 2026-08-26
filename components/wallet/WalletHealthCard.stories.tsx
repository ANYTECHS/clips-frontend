import type { Meta, StoryObj } from '@storybook/react';
import WalletHealthCard from './WalletHealthCard';

const meta: Meta<typeof WalletHealthCard> = {
  title: 'Wallet/WalletHealthCard',
  component: WalletHealthCard,
  tags: ['autodocs'],
  argTypes: {
    publicKey: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof WalletHealthCard>;

/**
 * WalletHealthCard drives its display from the useAutoStellarWallet hook.
 * In Storybook we render with a publicKey prop so the component renders its
 * outer shell; actual balance data requires a live Stellar connection, so the
 * idle / loading state is what's observable here without a wallet.
 */
export const WithPublicKey: Story = {
  args: {
    publicKey: 'GABC1234567890DEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
  },
};

export const NoPublicKey: Story = {
  name: 'No Public Key (renders null)',
  args: {
    publicKey: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'When `publicKey` is null, the component renders nothing.',
      },
    },
  },
};
