import type { Meta, StoryObj } from "@storybook/react";
import ClipsNavbar from "../components/clips/ClipsNavbar";

const meta: Meta<typeof ClipsNavbar> = {
  title: "Clips/ClipsNavbar",
  component: ClipsNavbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ClipsNavbar>;

export const Default: Story = {
  args: {},
};
