import type { Meta, StoryObj } from '@storybook/react';
import BrandKitManager from './BrandKitManager';

const meta: Meta<typeof BrandKitManager> = {
  title: 'BrandKit/BrandKitManager',
  component: BrandKitManager,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof BrandKitManager>;

export const Default: Story = {};
