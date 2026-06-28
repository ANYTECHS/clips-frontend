import type { Meta, StoryObj } from "@storybook/nextjs";
import InstagramIcon from "@/components/icons/InstagramIcon";
import TikTokIcon from "@/components/icons/TikTokIcon";
import YoutubeIcon from "@/components/icons/YoutubeIcon";
import TwitterIcon from "@/components/icons/TwitterIcon";
import React from "react";

const meta: Meta = {
  title: "Icons/PlatformIcons",
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0A0A0A" }],
    },
  },
  decorators: [
    (Story) => (
      <div className="flex gap-4 text-white p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj;

export const AllIcons: Story = {
  render: () => (
    <>
      <div className="flex flex-col items-center gap-2">
        <InstagramIcon className="text-[#E1306C]" size={32} />
        <span className="text-sm">Instagram</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TikTokIcon size={32} />
        <span className="text-sm">TikTok</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <YoutubeIcon className="text-[#FF0000]" size={32} />
        <span className="text-sm">YouTube</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TwitterIcon className="text-[#1DA1F2]" size={32} />
        <span className="text-sm">Twitter</span>
      </div>
    </>
  ),
};
