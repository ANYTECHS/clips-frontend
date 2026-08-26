import type { Meta, StoryObj } from '@storybook/react';
import PlatformDistribution from './PlatformDistribution';

const meta: Meta<typeof PlatformDistribution> = {
  title: 'Dashboard/PlatformDistribution',
  component: PlatformDistribution,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Placeholder component — not yet implemented.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PlatformDistribution>;

export const Default: Story = {};
