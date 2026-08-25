import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import ProjectFilters from './ProjectFilters';

const meta: Meta<typeof ProjectFilters> = {
  title: 'Projects/ProjectFilters',
  component: ProjectFilters,
  tags: ['autodocs'],
  argTypes: {
    onCaptionsStyleChange: { action: 'captions_style_changed' },
    onViralityLevelToggle: { action: 'virality_level_toggled' },
    onResetFilters: { action: 'filters_reset' },
    onVaultFilterChange: { action: 'vault_filter_changed' },
    mobile: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ProjectFilters>;

export const Default: Story = {
  args: {
    captionsStyle: 'All Styles',
    viralityLevels: [],
    activeFilterCount: 0,
    vaultFilter: 'pending',
    onCaptionsStyleChange: fn(),
    onViralityLevelToggle: fn(),
    onResetFilters: fn(),
    onVaultFilterChange: fn(),
  },
};

export const WithActiveFilters: Story = {
  args: {
    captionsStyle: 'Bold & Dynamic',
    viralityLevels: ['high', 'medium'],
    activeFilterCount: 3,
    vaultFilter: 'listed',
    onCaptionsStyleChange: fn(),
    onViralityLevelToggle: fn(),
    onResetFilters: fn(),
    onVaultFilterChange: fn(),
  },
};

export const AllFiltersActive: Story = {
  args: {
    captionsStyle: 'Minimalist',
    viralityLevels: ['high', 'medium', 'low'],
    activeFilterCount: 5,
    vaultFilter: 'history',
    onCaptionsStyleChange: fn(),
    onViralityLevelToggle: fn(),
    onResetFilters: fn(),
    onVaultFilterChange: fn(),
  },
};

export const Mobile: Story = {
  args: {
    captionsStyle: 'All Styles',
    viralityLevels: ['high'],
    activeFilterCount: 1,
    vaultFilter: 'pending',
    mobile: true,
    onCaptionsStyleChange: fn(),
    onViralityLevelToggle: fn(),
    onResetFilters: fn(),
    onVaultFilterChange: fn(),
  },
};
