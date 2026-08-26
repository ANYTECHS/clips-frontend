import type { Meta, StoryObj } from '@storybook/react';
import ErrorBoundary from './ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

/** Normal operation — children render without errors. */
export const Default: Story = {
  args: {
    children: (
      <div className="p-6 bg-surface border border-white/10 rounded-2xl text-white">
        <p className="font-bold">Child component rendered successfully.</p>
        <p className="text-sm text-muted-foreground mt-1">
          The ErrorBoundary is active but no error has been thrown.
        </p>
      </div>
    ),
  },
};

/** Custom fallback supplied by the parent. */
export const WithCustomFallback: Story = {
  args: {
    fallback: (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
        <p className="font-bold">Custom fallback UI</p>
        <p className="text-sm mt-1 opacity-80">
          This is a custom fallback provided via the <code>fallback</code> prop.
        </p>
      </div>
    ),
    children: (
      <div className="text-white">Normal children (no error thrown in Storybook).</div>
    ),
  },
};
