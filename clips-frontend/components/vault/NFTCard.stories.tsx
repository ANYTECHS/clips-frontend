import type { Meta, StoryObj } from '@storybook/react';
import NFTCard from './NFTCard';

const meta = {
  title: 'Vault/NFTCard',
  component: NFTCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['ready_to_mint', 'queue', 'minted'],
      description: 'NFT status',
    },
    rarity: {
      control: 'select',
      options: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      description: 'NFT rarity level',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NFTCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToMint: Story = {
  args: {
    id: '1',
    title: 'Epic Gaming Moment - Triple Kill',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    duration: '0:45',
    aiScore: 95,
    status: 'ready_to_mint',
    rarity: 'epic',
  },
};

export const InQueue: Story = {
  args: {
    id: '2',
    title: 'Funny Cat Compilation',
    thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop',
    duration: '1:30',
    aiScore: 88,
    status: 'queue',
    rarity: 'rare',
    queuePosition: 5,
  },
};

export const Minted: Story = {
  args: {
    id: '3',
    title: 'Tutorial: How to Code',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=400&fit=crop',
    duration: '2:15',
    aiScore: 92,
    status: 'minted',
    rarity: 'legendary',
    floorPrice: 0.5,
    currentValue: 0.75,
    mintedDate: '2024-01-15',
  },
};

export const CommonRarity: Story = {
  args: {
    id: '4',
    title: 'Daily Vlog Entry',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=400&fit=crop',
    duration: '0:30',
    aiScore: 75,
    status: 'ready_to_mint',
    rarity: 'common',
  },
};

export const UncommonRarity: Story = {
  args: {
    id: '5',
    title: 'Travel Vlog - Tokyo',
    thumbnail: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=400&fit=crop',
    duration: '3:00',
    aiScore: 85,
    status: 'ready_to_mint',
    rarity: 'uncommon',
  },
};

export const LegendaryMinted: Story = {
  args: {
    id: '6',
    title: 'Sports Highlight - Amazing Goal',
    thumbnail: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=400&fit=crop',
    duration: '0:15',
    aiScore: 98,
    status: 'minted',
    rarity: 'legendary',
    floorPrice: 1.2,
    currentValue: 1.5,
    mintedDate: '2024-02-20',
  },
};

export const PriceDecreased: Story = {
  args: {
    id: '7',
    title: 'Music Cover - Acoustic',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop',
    duration: '0:30',
    aiScore: 90,
    status: 'minted',
    rarity: 'rare',
    floorPrice: 0.3,
    currentValue: 0.25,
    mintedDate: '2024-03-10',
  },
};

export const HighQueuePosition: Story = {
  args: {
    id: '8',
    title: 'Cooking Tutorial',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
    duration: '5:00',
    aiScore: 82,
    status: 'queue',
    rarity: 'uncommon',
    queuePosition: 42,
  },
};
