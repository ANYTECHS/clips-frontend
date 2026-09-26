import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import ErrorUI from './ErrorUI';

const meta: Meta<typeof ErrorUI> = {
  title: 'UI/ErrorUI',
  component: ErrorUI,
  tags: ['autodocs'],
  argTypes: {
    reset: { action: 'reset_clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorUI>;

export const Default: Story = {
  args: {
    error: Object.assign(new Error('Something unexpected happened.'), {
      digest: 'err-abc-123',
    }),
    reset: fn(),
  },
};

export const WithoutDigest: Story = {
  args: {
    error: new Error('Network request failed. Please check your connection.'),
    reset: fn(),
  },
};

export const LongErrorMessage: Story = {
  args: {
    error: Object.assign(
      new Error(
        'TypeError: Cannot read properties of undefined (reading "map") at DashboardPage (dashboard/page.tsx:42:12)',
      ),
      { digest: 'err-xyz-789' },
    ),
    reset: fn(),
  },
};
