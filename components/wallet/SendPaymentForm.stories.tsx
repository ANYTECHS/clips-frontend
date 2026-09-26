import type { Meta, StoryObj } from '@storybook/react';
import { SendPaymentForm } from './SendPaymentForm';

const meta: Meta<typeof SendPaymentForm> = {
  title: 'Wallet/SendPaymentForm',
  component: SendPaymentForm,
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'submitted' },
  },
};

export default meta;
type Story = StoryObj<typeof SendPaymentForm>;

export const Default: Story = {
  args: {
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const ErrorState: Story = {
  args: {
    isLoading: false,
    errorMessage: 'Insufficient balance to complete payment.',
  },
};
