import type { Meta, StoryObj } from '@storybook/react';
import { ClipGrid } from './ClipGrid';

const meta: Meta<typeof ClipGrid> = {
  title: 'Dashboard/ClipGrid',
  component: ClipGrid,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClipGrid>;

const mockClips = [
  { id: '1', title: 'Epic Gaming Moment', views: '12K', duration: '0:30', thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300' },
  { id: '2', title: 'Cooking 101', views: '5.4K', duration: '1:00', thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300' },
  { id: '3', title: 'Tech Review', views: '45K', duration: '2:15', thumbnail: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=300' },
];

export const Default: Story = {
  args: {
    clips: mockClips,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    clips: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    clips: [],
    isLoading: false,
  },
};
