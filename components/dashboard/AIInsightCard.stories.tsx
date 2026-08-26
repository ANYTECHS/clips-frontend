import type { Meta, StoryObj } from '@storybook/react';
import AIInsightCard from './AIInsightCard';

const meta: Meta<typeof AIInsightCard> = {
  title: 'Dashboard/AIInsightCard',
  component: AIInsightCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AIInsightCard>;

function mockFetch(
  response: Record<string, unknown>,
  status = 200,
  delayMs = 0,
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes('/api/insights')) {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input);
  };
}

export const WithInsights: Story = {
  decorators: [
    (Story) => {
      mockFetch({
        insights: [
          { id: '1', text: 'Your gaming clips generate 3× more engagement on weekends.', createdAt: new Date().toISOString() },
          { id: '2', text: 'Clips under 30 seconds have a 45% higher completion rate.', createdAt: new Date().toISOString() },
          { id: '3', text: 'Adding captions increases watch time by an average of 22%.', createdAt: new Date().toISOString() },
        ],
      });
      return <Story />;
    },
  ],
};

export const Empty: Story = {
  decorators: [
    (Story) => {
      mockFetch({ insights: [] });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  decorators: [
    (Story) => {
      mockFetch({ insights: [] }, 200, 60_000);
      return <Story />;
    },
  ],
};

export const ErrorState: Story = {
  decorators: [
    (Story) => {
      mockFetch({ error: 'Failed to fetch insights' }, 500);
      return <Story />;
    },
  ],
};

export const APINotFound: Story = {
  name: 'API Not Found (Coming Soon)',
  decorators: [
    (Story) => {
      mockFetch({}, 404);
      return <Story />;
    },
  ],
};
