import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import {
  InstagramIcon,
  TikTokIcon,
  YoutubeIcon,
  TwitterIcon,
  PhantomIcon,
  MetaMaskIcon,
} from "@/components/icons";

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
  render: () => {
    const icons = [
      { label: "Instagram", component: <InstagramIcon className="text-[#E1306C]" /> },
      { label: "TikTok", component: <TikTokIcon /> },
      { label: "YouTube", component: <YoutubeIcon className="text-[#FF0000]" /> },
      { label: "Twitter", component: <TwitterIcon className="text-[#1DA1F2]" /> },
      { label: "Phantom", component: <PhantomIcon className="text-[#AB9BFF]" /> },
      { label: "MetaMask", component: <MetaMaskIcon className="text-[#F6851B]" /> },
    ];

    return (
      <div className="flex flex-col gap-6 text-white">
        {icons.map((icon) => (
          <div key={icon.label} className="flex flex-col gap-3">
            <div className="text-sm font-semibold">{icon.label}</div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                {icon.component}
                <span className="text-xs text-white/70">Default</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                {React.cloneElement(icon.component as React.ReactElement, { size: 18 })}
                <span className="text-xs text-white/70">Small</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                {React.cloneElement(icon.component as React.ReactElement, { size: 32 })}
                <span className="text-xs text-white/70">Large</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
};
