import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import Switch from './Switch';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the switch is on or off',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible label for screen readers',
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: {
    checked: false,
    ariaLabel: 'Toggle feature',
    onChange: () => {},
  },
};

export const On: Story = {
  args: {
    checked: true,
    ariaLabel: 'Toggle feature',
    onChange: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex flex-col gap-4">
        <Switch 
          checked={checked} 
          onChange={setChecked}
          ariaLabel="Toggle notifications"
        />
        <p className="text-sm text-muted">
          Status: {checked ? 'On' : 'Off'}
        </p>
      </div>
    );
  },
};

export const WithLabels: Story = {
  render: () => {
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [autoSave, setAutoSave] = useState(true);
    
    return (
      <div className="flex flex-col gap-6 w-[300px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Notifications</p>
            <p className="text-xs text-muted">Receive email notifications</p>
          </div>
          <Switch 
            checked={notifications} 
            onChange={setNotifications}
            ariaLabel="Toggle notifications"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Dark Mode</p>
            <p className="text-xs text-muted">Use dark theme</p>
          </div>
          <Switch 
            checked={darkMode} 
            onChange={setDarkMode}
            ariaLabel="Toggle dark mode"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Auto Save</p>
            <p className="text-xs text-muted">Automatically save changes</p>
          </div>
          <Switch 
            checked={autoSave} 
            onChange={setAutoSave}
            ariaLabel="Toggle auto save"
          />
        </div>
      </div>
    );
  },
};
