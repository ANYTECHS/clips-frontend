import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import VirtualList from "./VirtualList";

interface Row {
  id: number;
  label: string;
}

const rows: Row[] = Array.from({ length: 2000 }, (_, i) => ({
  id: i,
  label: `Transaction #${i + 1}`,
}));

/**
 * Windowed list: only rows near the viewport are mounted, while the container
 * keeps the full list's height. Rows must have a fixed `rowHeight`.
 * Scroll the canvas to see rows mount and unmount.
 */
const meta: Meta<typeof VirtualList<Row>> = {
  title: "Common/VirtualList",
  component: VirtualList,
  tags: ["autodocs"],
  args: {
    items: rows,
    rowHeight: 56,
    gap: 8,
    ariaRole: "list",
    itemKey: (row: Row) => row.id,
    renderItem: (row: Row) => (
      <div
        role="listitem"
        className="h-full flex items-center px-4 rounded-xl bg-surface border border-white/5 text-sm"
      >
        {row.label}
      </div>
    ),
  },
  argTypes: {
    items: { control: false },
    itemKey: { control: false },
    renderItem: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VirtualList<Row>>;

export const TwoThousandRows: Story = {};

export const NoGap: Story = { args: { gap: 0, rowHeight: 48 } };
