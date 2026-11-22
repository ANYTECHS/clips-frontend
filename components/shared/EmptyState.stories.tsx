import type { Meta, StoryObj } from "@storybook/react";
import EmptyState from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Clips: Story = {
  args: {
    illustration: "clips",
    title: "No clips yet",
    description: "Upload your first video and our AI will find the viral moments.",
    ctaLabel: "Upload your first video",
    onCta: () => {},
  },
};

export const Projects: Story = {
  args: {
    illustration: "projects",
    title: "No projects yet",
    description: "Create a project to organize your clips.",
    ctaLabel: "New project",
    onCta: () => {},
  },
};

export const Earnings: Story = {
  args: {
    illustration: "earnings",
    title: "No earnings yet",
    description: "Tips and mints will appear here once your clips earn.",
    ctaLabel: "Share a clip",
    onCta: () => {},
  },
};
