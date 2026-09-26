import type { Meta, StoryObj } from "@storybook/react";
import ClipsStats from "../components/clips/ClipsStats";

const meta: Meta<typeof ClipsStats> = {
  title: "Clips/ClipsStats",
  component: ClipsStats,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ClipsStats>;

export const Default: Story = {
  args: {},
};
