import type { Meta, StoryObj } from "@storybook/nextjs";
import DonutChart from "@/components/charts/DonutChart";
import Sparkline from "@/components/charts/Sparkline";
import React from "react";

const meta: Meta = {
  title: "Charts/WalletCharts",
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0A0A0A" }],
    },
  },
  decorators: [
    (Story) => (
      <div className="flex gap-4 text-white p-8 w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;

export const WalletDonutChart: StoryObj = {
  render: () => (
    <div className="w-40 h-40">
      <DonutChart
        slices={[
          { label: "XLM", value: 50, color: "#00FF9D" },
          { label: "USDC", value: 30, color: "#3B82F6" },
          { label: "BTC", value: 20, color: "#F59E0B" },
        ]}
      />
    </div>
  ),
};

export const WalletSparkline: StoryObj = {
  render: () => (
    <div className="w-64 h-16">
      <Sparkline values={[10, 15, 13, 20, 18, 25, 22, 30]} color="#00FF9D" />
    </div>
  ),
};
