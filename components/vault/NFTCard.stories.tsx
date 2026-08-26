import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import NFTCard from './NFTCard';

const meta: Meta<typeof NFTCard> = {
  title: 'Vault/NFTCard',
  component: NFTCard,
  tags: ['autodocs'],
  argTypes: {
    mintStatus: {
      control: 'select',
      options: ['pending', 'minted', 'listed', 'failed'],
    },
    viralityScore: { control: { type: 'range', min: 0, max: 100 } },
    onAction: { action: 'action_clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof NFTCard>;

export const Pending: Story = {
  args: {
    id: 'nft-001',
    title: 'Epic Gaming Moment #1',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=340&fit=crop',
    viralityScore: 85,
    mintStatus: 'pending',
    onAction: fn(),
  },
};

export const Minted: Story = {
  args: {
    id: 'nft-002',
    title: 'Cooking Tutorial Highlight',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&h=340&fit=crop',
    viralityScore: 72,
    mintStatus: 'minted',
    onAction: fn(),
  },
};

export const Listed: Story = {
  args: {
    id: 'nft-003',
    title: 'Tech Review Compilation',
    thumbnail: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=600&h=340&fit=crop',
    viralityScore: 94,
    mintStatus: 'listed',
    onAction: fn(),
  },
};

export const Failed: Story = {
  args: {
    id: 'nft-004',
    title: 'Music Video Clip',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=340&fit=crop',
    viralityScore: 61,
    mintStatus: 'failed',
    onAction: fn(),
  },
};

export const LowViralityScore: Story = {
  args: {
    id: 'nft-005',
    title: 'Low Engagement Short',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=340&fit=crop',
    viralityScore: 12,
    mintStatus: 'pending',
    onAction: fn(),
  },
};
