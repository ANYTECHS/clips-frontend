import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import MintConfigForm from './MintConfigForm';

const meta: Meta<typeof MintConfigForm> = {
  title: 'Projects/MintConfigForm',
  component: MintConfigForm,
  tags: ['autodocs'],
  argTypes: {
    onSubmit: { action: 'form_submitted' },
  },
};

export default meta;
type Story = StoryObj<typeof MintConfigForm>;

export const Default: Story = {
  args: {
    onSubmit: fn(async () => {}),
  },
};

export const SubmitError: Story = {
  args: {
    onSubmit: fn(async () => {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Insufficient XLM balance for minting fee.')), 800),
      );
    }),
  },
};

export const SlowSubmit: Story = {
  args: {
    onSubmit: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }),
  },
};
