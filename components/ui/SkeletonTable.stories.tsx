import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SkeletonTable from "./SkeletonTable";

/** Placeholder matching the layout of `EarningsTable`, with an optional filter bar. */
const meta: Meta<typeof SkeletonTable> = {
  title: "UI/SkeletonTable",
  component: SkeletonTable,
  tags: ["autodocs"],
  argTypes: {
    rows: { control: { type: "number", min: 1, max: 20 } },
    cols: { control: { type: "number", min: 1, max: 10 } },
  },
};

export default meta;
type Story = StoryObj<typeof SkeletonTable>;

export const Default: Story = {};

export const WithoutFilterBar: Story = { args: { showFilterBar: false } };

export const Compact: Story = { args: { rows: 3, cols: 4 } };
