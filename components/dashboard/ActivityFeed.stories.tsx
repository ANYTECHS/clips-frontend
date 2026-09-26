import type { Meta, StoryObj } from "@storybook/react";
import { ActivityFeed } from "./ActivityFeed";

const meta: Meta<typeof ActivityFeed> = {
  title: "Dashboard/ActivityFeed",
  component: ActivityFeed,
  tags: ["autodocs"],
  argTypes: {
    onItemClick: { action: "item_clicked" },
    onRefresh: { action: "refresh_triggered" },
  },
};

export default meta;
type Story = StoryObj<typeof ActivityFeed>;

const mockActivities = [
  { id: "1", type: "mint", label: "Minted 500 CLIPS", timestamp: "2 mins ago", status: "success" },
  { id: "2", type: "payment", label: "Sent payment to GABC...", timestamp: "1 hour ago", status: "success" },
  { id: "3", type: "trustline", label: "Established minor trustline", timestamp: "1 day ago", status: "failed" },
];

export const Default: Story = {
  args: {
    items: mockActivities,
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    isLoading: false,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    items: [],
    isLoading: false,
    error: "Network stream connection interrupted. Unable to sync feed updates.",
  },
};
