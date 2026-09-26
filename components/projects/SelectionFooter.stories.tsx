import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import SelectionFooter from './SelectionFooter';

const meta: Meta<typeof SelectionFooter> = {
  title: 'Projects/SelectionFooter',
  component: SelectionFooter,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-screen bg-background">
        <div className="p-8 text-white text-sm text-muted-foreground">
          Page content above the footer
        </div>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onMint: { action: 'mint_clicked' },
    undo: { action: 'undo_clicked' },
    redo: { action: 'redo_clicked' },
    onPost: { action: 'post_clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof SelectionFooter>;

export const Default: Story = {
  args: {
    count: 3,
    selectedIds: ['clip-1', 'clip-2', 'clip-3'],
    onMint: fn(),
    isMinting: false,
    undo: fn(),
    redo: fn(),
    canUndo: true,
    canRedo: false,
    onPost: fn(),
    isPosting: false,
    postError: null,
  },
};

export const Minting: Story = {
  args: {
    count: 5,
    selectedIds: ['clip-1', 'clip-2', 'clip-3', 'clip-4', 'clip-5'],
    onMint: fn(),
    isMinting: true,
    undo: fn(),
    redo: fn(),
    canUndo: false,
    canRedo: false,
    onPost: fn(),
    isPosting: false,
    postError: null,
  },
};

export const Posting: Story = {
  args: {
    count: 2,
    selectedIds: ['clip-1', 'clip-2'],
    onMint: fn(),
    isMinting: false,
    undo: fn(),
    redo: fn(),
    canUndo: true,
    canRedo: true,
    onPost: fn(),
    isPosting: true,
    postError: null,
  },
};

export const PostError: Story = {
  args: {
    count: 2,
    selectedIds: ['clip-1', 'clip-2'],
    onMint: fn(),
    isMinting: false,
    undo: fn(),
    redo: fn(),
    canUndo: true,
    canRedo: false,
    onPost: fn(),
    isPosting: false,
    postError: 'Failed to post to Instagram. Please reconnect your account.',
  },
};

export const SingleSelection: Story = {
  args: {
    count: 1,
    selectedIds: ['clip-1'],
    onMint: fn(),
    isMinting: false,
    undo: fn(),
    redo: fn(),
    canUndo: false,
    canRedo: false,
    postError: null,
  },
};
