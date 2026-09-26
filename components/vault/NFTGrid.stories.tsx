import type { Meta, StoryObj } from '@storybook/react';
import NFTGrid from './NFTGrid';

const meta: Meta<typeof NFTGrid> = {
  title: 'Vault/NFTGrid',
  component: NFTGrid,
  tags: ['autodocs'],
  argTypes: {
    filter: {
      control: 'select',
      options: ['pending', 'listed', 'history'],
    },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof NFTGrid>;

export const Pending: Story = {
  args: {
    filter: 'pending',
    loading: false,
  },
};

export const Listed: Story = {
  args: {
    filter: 'listed',
    loading: false,
  },
};

export const History: Story = {
  args: {
    filter: 'history',
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    filter: 'pending',
    loading: true,
  },
};
