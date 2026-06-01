import type { Meta, StoryObj } from '@storybook/react';
import Skeleton from './Skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: 'w-full h-4',
  },
};

export const Circle: Story = {
  args: {
    className: 'w-12 h-12 rounded-full',
  },
};

export const Rectangle: Story = {
  args: {
    className: 'w-64 h-32',
  },
};

export const Text: Story = {
  args: {
    className: 'w-48 h-4',
  },
};

export const CardSkeleton: Story = {
  render: () => (
    <div className="bg-surface border border-border rounded-[24px] p-6 w-[350px]">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-3/4 h-4" />
          <Skeleton className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-32 mb-4" />
      <div className="space-y-2">
        <Skeleton className="w-full h-3" />
        <Skeleton className="w-5/6 h-3" />
        <Skeleton className="w-4/6 h-3" />
      </div>
    </div>
  ),
};

export const ListSkeleton: Story = {
  render: () => (
    <div className="space-y-4 w-[400px]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const TableSkeleton: Story = {
  render: () => (
    <div className="w-full max-w-2xl space-y-3">
      <div className="flex gap-4">
        <Skeleton className="flex-1 h-10" />
        <Skeleton className="flex-1 h-10" />
        <Skeleton className="flex-1 h-10" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="flex-1 h-12" />
        </div>
      ))}
    </div>
  ),
};
