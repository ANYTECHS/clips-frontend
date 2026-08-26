import type { Meta, StoryObj } from '@storybook/react';
import WalletInfoCard from './WalletInfoCard';

const meta: Meta<typeof WalletInfoCard> = {
  title: 'Dashboard/WalletInfoCard',
  component: WalletInfoCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Placeholder component — not yet implemented.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WalletInfoCard>;

export const Default: Story = {};
