import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import Button, { BUTTON_SIZES, BUTTON_VARIANTS } from "./Button";

const meta = {
  title: "Shared/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "select", options: BUTTON_SIZES },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
export const Link: Story = { args: { variant: "link", children: "Learn more" } };

export const Small: Story = { args: { size: "sm" } };
export const Medium: Story = { args: { size: "md" } };
export const Large: Story = { args: { size: "lg" } };
export const Icon: Story = {
  args: { size: "icon", variant: "secondary", "aria-label": "Add", children: <Plus className="w-4 h-4" /> },
};

export const Loading: Story = { args: { loading: true, children: "Saving" } };
export const Disabled: Story = { args: { disabled: true } };
export const FullWidth: Story = {
  args: { fullWidth: true },
  parameters: { layout: "padded" },
};

/** Every variant × size combination. */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: args => (
    <div className="grid grid-cols-[auto_repeat(3,auto)] gap-4 items-center">
      <span />
      {(["sm", "md", "lg"] as const).map(size => (
        <span key={size} className="text-xs text-[#90A89C] uppercase">
          {size}
        </span>
      ))}
      {BUTTON_VARIANTS.map(variant => (
        <React.Fragment key={variant}>
          <span className="text-xs text-[#90A89C] uppercase">{variant}</span>
          {(["sm", "md", "lg"] as const).map(size => (
            <Button key={size} {...args} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
        </React.Fragment>
      ))}
    </div>
  ),
};
