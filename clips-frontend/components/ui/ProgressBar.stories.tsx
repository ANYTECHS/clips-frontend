import type { Meta, StoryObj } from '@storybook/react';
import ProgressBar from './ProgressBar';

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Progress value from 0 to 100',
    },
    color: {
      control: 'color',
      description: 'The color of the progress bar',
    },
    label: {
      control: 'text',
      description: 'Accessible label for screen readers',
    },
    animated: {
      control: 'boolean',
      description: 'Enable smooth animation',
    },
    height: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Height of the progress bar',
    },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 65,
    color: '#00E58F',
    label: 'Upload progress',
    animated: true,
    height: 'md',
  },
};

export const Small: Story = {
  args: {
    value: 45,
    color: '#00E58F',
    label: 'Processing',
    animated: true,
    height: 'sm',
  },
};

export const Large: Story = {
  args: {
    value: 80,
    color: '#00E58F',
    label: 'Download progress',
    animated: true,
    height: 'lg',
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    color: '#00E58F',
    label: 'Not started',
    animated: true,
    height: 'md',
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    color: '#00E58F',
    label: 'Complete',
    animated: true,
    height: 'md',
  },
};

export const Warning: Story = {
  args: {
    value: 75,
    color: '#FFA500',
    label: 'Warning level',
    animated: true,
    height: 'md',
  },
};

export const Error: Story = {
  args: {
    value: 90,
    color: '#FF4444',
    label: 'Critical level',
    animated: true,
    height: 'md',
  },
};

export const NoAnimation: Story = {
  args: {
    value: 50,
    color: '#00E58F',
    label: 'Static progress',
    animated: false,
    height: 'md',
  },
};

export const MultipleStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div>
        <p className="text-sm text-muted mb-2">Starting (10%)</p>
        <ProgressBar value={10} color="#00E58F" label="Starting" height="md" />
      </div>
      <div>
        <p className="text-sm text-muted mb-2">In Progress (45%)</p>
        <ProgressBar value={45} color="#00E58F" label="In Progress" height="md" />
      </div>
      <div>
        <p className="text-sm text-muted mb-2">Almost Done (85%)</p>
        <ProgressBar value={85} color="#00E58F" label="Almost Done" height="md" />
      </div>
      <div>
        <p className="text-sm text-muted mb-2">Complete (100%)</p>
        <ProgressBar value={100} color="#00E58F" label="Complete" height="md" />
      </div>
    </div>
  ),
};
