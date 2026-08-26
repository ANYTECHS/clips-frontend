import type { Meta, StoryObj } from "@storybook/react";
import ScoreBreakdownTooltip from "./ScoreBreakdownTooltip";

const meta: Meta<typeof ScoreBreakdownTooltip> = {
  title: "Projects/ScoreBreakdownTooltip",
  component: ScoreBreakdownTooltip,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-12 bg-gray-950 flex items-center justify-center min-h-[300px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScoreBreakdownTooltip>;

export const HighScore: Story = {
  args: {
    score: 94,
    scoreKey: "high",
    scoreBreakdown: {
      hook: 98,
      retention: 92,
      emotional: 90,
      trending: 96,
    },
  },
};

export const MediumScore: Story = {
  args: {
    score: 68,
    scoreKey: "medium",
    scoreBreakdown: {
      hook: 72,
      retention: 65,
      emotional: 68,
      trending: 67,
    },
  },
};

export const LowScore: Story = {
  args: {
    score: 42,
    scoreKey: "low",
    scoreBreakdown: {
      hook: 45,
      retention: 38,
      emotional: 42,
      trending: 43,
    },
  },
};

export const MixedViralHook: Story = {
  args: {
    score: 85,
    scoreKey: "high",
    scoreBreakdown: {
      hook: 99,
      retention: 40,
      emotional: 95,
      trending: 90,
    },
  },
};

export const DefaultFallbackBreakdown: Story = {
  args: {
    score: 78,
    scoreKey: "medium",
  },
};
