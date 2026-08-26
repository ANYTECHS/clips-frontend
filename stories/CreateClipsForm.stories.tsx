import type { Meta, StoryObj } from "@storybook/react";
import CreateClipsForm from "../components/clips/CreateClipsForm";

const meta: Meta<typeof CreateClipsForm> = {
  title: "Clips/CreateClipsForm",
  component: CreateClipsForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CreateClipsForm>;

export const Default: Story = {
  args: {},
};
