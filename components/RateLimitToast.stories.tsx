import type { Meta, StoryObj } from '@storybook/react';
import RateLimitToast from './RateLimitToast';

const meta: Meta<typeof RateLimitToast> = {
  title: 'Components/RateLimitToast',
  component: RateLimitToast,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RateLimitToast>;

export const Default: Story = {
  render: () => {
    return (
      <div>
        <RateLimitToast />
        <div className="p-8">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('rate-limit-exceeded', {
                  detail: { retryAfter: 30 },
                })
              );
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Trigger Rate Limit (30 seconds)
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('rate-limit-exceeded', {
                  detail: { retryAfter: 5 },
                })
              );
            }}
            className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Trigger Rate Limit (5 seconds)
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('rate-limit-exceeded', {
                  detail: { retryAfter: 1 },
                })
              );
            }}
            className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            Trigger Rate Limit (1 second)
          </button>
        </div>
      </div>
    );
  },
};

export const LongWaitTime: Story = {
  render: () => {
    return (
      <div>
        <RateLimitToast />
        <div className="p-8">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('rate-limit-exceeded', {
                  detail: { retryAfter: 120 },
                })
              );
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Trigger Rate Limit (2 minutes)
          </button>
        </div>
      </div>
    );
  },
};

export const MultipleEvents: Story = {
  render: () => {
    return (
      <div>
        <RateLimitToast />
        <div className="p-8">
          <button
            onClick={() => {
              // Dispatch multiple events to test that only one toast shows
              window.dispatchEvent(
                new CustomEvent('rate-limit-exceeded', {
                  detail: { retryAfter: 30 },
                })
              );
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('rate-limit-exceeded', {
                    detail: { retryAfter: 60 },
                  })
                );
              }, 100);
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('rate-limit-exceeded', {
                    detail: { retryAfter: 15 },
                  })
                );
              }, 200);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Trigger Multiple Events (should update existing toast)
          </button>
        </div>
      </div>
    );
  },
};
