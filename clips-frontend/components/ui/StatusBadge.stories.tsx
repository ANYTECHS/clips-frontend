import type { Meta, StoryObj } from '@storybook/react';
import StatusBadge from './StatusBadge';

const meta = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['completed', 'pending', 'failed'],
      description: 'The status type to display',
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
      description: 'The size of the badge',
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    status: 'completed',
    size: 'md',
  },
};

export const Pending: Story = {
  args: {
    status: 'pending',
    size: 'md',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    size: 'md',
  },
};

export const CompletedSmall: Story = {
  args: {
    status: 'completed',
    size: 'sm',
  },
};

export const PendingSmall: Story = {
  args: {
    status: 'pending',
    size: 'sm',
  },
};

export const FailedSmall: Story = {
  args: {
    status: 'failed',
    size: 'sm',
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <span className="text-muted w-24">Medium:</span>
        <StatusBadge status="completed" size="md" />
        <StatusBadge status="pending" size="md" />
        <StatusBadge status="failed" size="md" />
      </div>
      <div className="flex gap-4 items-center">
        <span className="text-muted w-24">Small:</span>
        <StatusBadge status="completed" size="sm" />
        <StatusBadge status="pending" size="sm" />
        <StatusBadge status="failed" size="sm" />
      </div>
    </div>
  ),
};
