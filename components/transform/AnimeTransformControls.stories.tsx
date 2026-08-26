import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { AnimeTransformControls } from './AnimeTransformControls';
import { DEFAULT_ANIME_OPTIONS } from '@/app/lib/animeTransform';

const meta: Meta<typeof AnimeTransformControls> = {
  title: 'Transform/AnimeTransformControls',
  component: AnimeTransformControls,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'options_changed' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof AnimeTransformControls>;

export const Default: Story = {
  args: {
    value: DEFAULT_ANIME_OPTIONS,
    disabled: false,
    onChange: fn(),
  },
};

export const Shojo: Story = {
  args: {
    value: {
      subStyle: 'shojo',
      colorIntensity: 85,
      outlineThickness: 'thin',
      backgroundStyle: 'painted',
    },
    disabled: false,
    onChange: fn(),
  },
};

export const MechaHighIntensity: Story = {
  name: 'Mecha — High Intensity',
  args: {
    value: {
      subStyle: 'mecha',
      colorIntensity: 100,
      outlineThickness: 'bold',
      backgroundStyle: 'cel-shaded',
    },
    disabled: false,
    onChange: fn(),
  },
};

export const GhibliMuted: Story = {
  name: 'Ghibli-inspired — Muted',
  args: {
    value: {
      subStyle: 'ghibli-inspired',
      colorIntensity: 30,
      outlineThickness: 'thin',
      backgroundStyle: 'painted',
    },
    disabled: false,
    onChange: fn(),
  },
};

export const Disabled: Story = {
  args: {
    value: DEFAULT_ANIME_OPTIONS,
    disabled: true,
    onChange: fn(),
  },
};
