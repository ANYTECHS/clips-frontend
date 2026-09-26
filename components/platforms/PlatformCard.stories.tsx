import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Wallet } from "lucide-react";
import PlatformCard, { PlatformCardSkeleton } from "./PlatformCard";
import YoutubeIcon from "../icons/YoutubeIcon";

/**
 * Connect / disconnect card for a social platform or wallet.
 *
 * - `vertical` is used in the social platforms grid.
 * - `horizontal` is used for wallet rows.
 *
 * ```tsx
 * <PlatformCard
 *   id="youtube"
 *   name="YouTube"
 *   description="Publish Shorts directly to your channel."
 *   icon={YoutubeIcon}
 *   status="NOT LINKED"
 *   ctaText="Connect"
 *   variant="vertical"
 *   onConnect={() => signIn('google')}
 * />
 * ```
 */
const meta: Meta<typeof PlatformCard> = {
  title: "Platforms/PlatformCard",
  component: PlatformCard,
  tags: ["autodocs"],
  args: {
    id: "youtube",
    name: "YouTube",
    description: "Publish Shorts directly to your channel.",
    icon: YoutubeIcon,
    status: "NOT LINKED",
    ctaText: "Connect",
    variant: "vertical",
    onConnect: fn(),
    onDisconnect: fn(),
  },
  argTypes: {
    status: { control: "inline-radio", options: ["ACTIVE", "LINKED", "NOT LINKED"] },
    variant: { control: "inline-radio", options: ["vertical", "horizontal"] },
    icon: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlatformCard>;

export const NotLinked: Story = {};

export const Active: Story = {
  args: { status: "ACTIVE", username: "@clipcash", ctaText: "Manage" },
};

export const Connecting: Story = {
  args: { isLoading: true },
};

export const ComingSoon: Story = {
  args: { isComingSoon: true, ctaText: "Coming Soon" },
};

export const HorizontalWallet: Story = {
  args: {
    id: "freighter",
    name: "Freighter",
    description: "Stellar browser wallet",
    icon: Wallet,
    variant: "horizontal",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export const HorizontalLinked: Story = {
  args: {
    ...HorizontalWallet.args,
    status: "LINKED",
    username: "GABC…XYZ",
    ctaText: "Disconnect",
  },
  decorators: HorizontalWallet.decorators,
};

export const Skeletons: Story = {
  render: () => (
    <div className="space-y-6 w-[640px]">
      <div className="max-w-sm">
        <PlatformCardSkeleton variant="vertical" />
      </div>
      <PlatformCardSkeleton variant="horizontal" />
    </div>
  ),
};
