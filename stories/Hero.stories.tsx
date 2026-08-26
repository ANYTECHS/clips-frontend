import type { Meta, StoryObj } from "@storybook/react";
import Hero from "../components/clips/Hero";

const meta: Meta<typeof Hero> = {
  title: "Clips/Hero",
  component: Hero,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Hero>;

export const Default: Story = {
  args: {},
};
