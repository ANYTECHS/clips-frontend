import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CardGridSkeleton, CardSkeleton, RowSkeleton, TextSkeleton } from "./SkeletonPresets";

/** Ready-made skeleton shapes for common layouts: cards, card grids, text blocks and list rows. */
const meta: Meta<typeof CardGridSkeleton> = {
  title: "UI/SkeletonPresets",
  component: CardGridSkeleton,
  tags: ["autodocs"],
  argTypes: { count: { control: { type: "number", min: 1, max: 16 } } },
};

export default meta;
type Story = StoryObj<typeof CardGridSkeleton>;

export const CardGrid: Story = { args: { count: 4 } };

export const Card: Story = {
  render: () => (
    <div className="w-56">
      <CardSkeleton />
    </div>
  ),
};

export const Text: Story = {
  render: () => (
    <div className="w-80">
      <TextSkeleton lines={4} />
    </div>
  ),
};

export const Rows: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </div>
  ),
};
