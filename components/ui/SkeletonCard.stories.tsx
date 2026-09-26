import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SkeletonCard from "./SkeletonCard";

/** Placeholder matching the proportions of `StatCard` / `EarningsSummaryCards`. */
const meta: Meta<typeof SkeletonCard> = {
  title: "UI/SkeletonCard",
  component: SkeletonCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SkeletonCard>;

export const Default: Story = {};

export const WithoutHeader: Story = { args: { showHeader: false } };

export const TallValue: Story = { args: { valueHeight: "h-12" } };
