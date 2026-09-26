import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import NotFound from '@/app/not-found';

const meta = {
  title: 'App/NotFound',
  component: NotFound,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};