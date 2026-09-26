import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Share2, Wallet } from "lucide-react";
import SectionHeader from "./SectionHeader";

/** Icon + title heading used to separate sections on the Platforms page. */
const meta: Meta<typeof SectionHeader> = {
  title: "Platforms/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
  args: { title: "Social Platforms", icon: Share2 },
  argTypes: { icon: { control: false } },
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const TitleOnly: Story = {};

export const WithDescription: Story = {
  args: {
    title: "Wallets",
    icon: Wallet,
    description: "Connect a Stellar wallet to receive payouts and mint NFTs.",
  },
};
