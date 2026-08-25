import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { StyleCard } from './StyleCard';
import type { TransformStyle } from '@/app/api/transform/styles/route';

const meta: Meta<typeof StyleCard> = {
  title: 'Transform/StyleCard',
  component: StyleCard,
  tags: ['autodocs'],
  argTypes: {
    onSelect: { action: 'style_selected' },
    isSelected: { control: 'boolean' },
    isDisabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof StyleCard>;

const animeStyle: TransformStyle = {
  name: 'anime',
  label: 'Anime',
  description: 'Bold outlines, vivid colours, cel-shaded look',
  thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=340&fit=crop',
  avgDurationSeconds: 45,
};

export const Default: Story = {
  args: {
    style: animeStyle,
    isSelected: false,
    isDisabled: false,
    onSelect: fn(),
  },
};

export const Selected: Story = {
  args: {
    style: animeStyle,
    isSelected: true,
    isDisabled: false,
    onSelect: fn(),
  },
};

export const Disabled: Story = {
  args: {
    style: animeStyle,
    isSelected: false,
    isDisabled: true,
    onSelect: fn(),
  },
};

export const DisabledSelected: Story = {
  name: 'Disabled + Selected',
  args: {
    style: animeStyle,
    isSelected: true,
    isDisabled: true,
    onSelect: fn(),
  },
};

export const LongDuration: Story = {
  args: {
    style: {
      name: 'neon-noir',
      label: 'Neon Noir',
      description: 'High-contrast shadows with vivid neon accent lighting',
      thumbnail: 'https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=600&h=340&fit=crop',
      avgDurationSeconds: 125,
    },
    isSelected: false,
    isDisabled: false,
    onSelect: fn(),
  },
};
