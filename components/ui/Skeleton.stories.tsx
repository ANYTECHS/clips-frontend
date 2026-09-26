import type { Meta, StoryObj } from '@storybook/react';
import Skeleton from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    className: 'h-4 w-48 rounded bg-white/10 animate-pulse',
  },
};

export const TextLine: Story = {
  args: {
    className: 'h-4 w-full max-w-xs rounded bg-white/10 animate-pulse',
  },
};

export const Avatar: Story = {
  args: {
    className: 'h-12 w-12 rounded-full bg-white/10 animate-pulse',
  },
};

export const Card: Story = {
  render: () => (
    <div className="space-y-3 p-4 bg-surface border border-white/10 rounded-2xl w-72">
      <Skeleton className="aspect-video w-full rounded-xl bg-white/10 animate-pulse" />
      <Skeleton className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
      <Skeleton className="h-3 w-full rounded bg-white/10 animate-pulse" />
      <Skeleton className="h-3 w-2/3 rounded bg-white/10 animate-pulse" />
    </div>
  ),
};

export const List: Story = {
  render: () => (
    <div className="space-y-3 w-80">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full bg-white/10 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32 rounded bg-white/10 animate-pulse" />
            <Skeleton className="h-3 w-full rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  ),
};
