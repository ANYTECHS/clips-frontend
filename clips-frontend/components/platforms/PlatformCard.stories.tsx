import type { Meta, StoryObj } from '@storybook/react';
import PlatformCard from './PlatformCard';
import { Youtube, Instagram, Twitter, Facebook } from 'lucide-react';

const meta = {
  title: 'Platforms/PlatformCard',
  component: PlatformCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onConnect: () => {},
    onDisconnect: () => {},
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['ACTIVE', 'NOT LINKED', 'LINKED'],
      description: 'Platform connection status',
    },
    variant: {
      control: 'select',
      options: ['vertical', 'horizontal'],
      description: 'Card layout variant',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state',
    },
    isComingSoon: {
      control: 'boolean',
      description: 'Coming soon state (disabled)',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlatformCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotLinked: Story = {
  args: {
    name: 'YouTube',
    description: 'Connect your YouTube channel',
    icon: Youtube,
    status: 'NOT LINKED',
    ctaText: 'Connect YouTube',
    variant: 'vertical',
  },
};

export const Linked: Story = {
  args: {
    name: 'Instagram',
    description: 'Post directly to Instagram Reels',
    icon: Instagram,
    status: 'LINKED',
    ctaText: 'Manage',
    username: '@johndoe',
    variant: 'vertical',
  },
};

export const Active: Story = {
  args: {
    name: 'TikTok',
    description: 'Auto-post to TikTok',
    icon: Twitter,
    status: 'ACTIVE',
    ctaText: 'Settings',
    username: '@creator123',
    variant: 'vertical',
  },
};

export const Loading: Story = {
  args: {
    name: 'Facebook',
    description: 'Connect your Facebook page',
    icon: Facebook,
    status: 'NOT LINKED',
    ctaText: 'Connect Facebook',
    variant: 'vertical',
    isLoading: true,
  },
};

export const ComingSoon: Story = {
  args: {
    name: 'Twitter',
    description: 'Coming soon',
    icon: Twitter,
    status: 'NOT LINKED',
    ctaText: 'Coming Soon',
    variant: 'vertical',
    isComingSoon: true,
  },
};

export const HorizontalNotLinked: Story = {
  args: {
    name: 'YouTube',
    description: 'Connect your YouTube channel',
    icon: Youtube,
    status: 'NOT LINKED',
    ctaText: 'Connect',
    variant: 'horizontal',
  },
};

export const HorizontalLinked: Story = {
  args: {
    name: 'Instagram',
    description: 'Post directly to Instagram Reels',
    icon: Instagram,
    status: 'LINKED',
    ctaText: 'Manage',
    username: '@johndoe',
    variant: 'horizontal',
  },
};

export const HorizontalLoading: Story = {
  args: {
    name: 'TikTok',
    description: 'Auto-post to TikTok',
    icon: Twitter,
    status: 'NOT LINKED',
    ctaText: 'Connect',
    variant: 'horizontal',
    isLoading: true,
  },
};
