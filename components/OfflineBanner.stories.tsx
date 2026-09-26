import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import OfflineBanner from "./OfflineBanner";

/**
 * Fixed banner reporting connectivity and offline-sync state. It renders
 * nothing when the app is online and idle.
 *
 * Normally driven by `DataSyncProvider`; the props are set by hand here.
 */
const meta: Meta<typeof OfflineBanner> = {
  title: "Feedback/OfflineBanner",
  component: OfflineBanner,
  tags: ["autodocs"],
  args: { isOnline: false, position: "top", compact: false, onRetry: fn() },
  argTypes: {
    position: { control: "inline-radio", options: ["top", "bottom"] },
    syncStatus: {
      control: "select",
      options: [undefined, "idle", "syncing", "synced", "failed", "offline", "reconnecting"],
    },
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[120px]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof OfflineBanner>;

export const Offline: Story = {};

export const OfflineWithPendingChanges: Story = { args: { pendingCount: 3 } };

export const Compact: Story = { args: { compact: true } };

export const Reconnecting: Story = { args: { isOnline: true, isChecking: true } };

export const Syncing: Story = { args: { isOnline: true, syncStatus: "syncing" } };

export const SyncFailed: Story = { args: { isOnline: true, syncStatus: "failed" } };

export const Synced: Story = { args: { isOnline: true, syncStatus: "synced" } };

export const BottomPosition: Story = { args: { position: "bottom" } };
