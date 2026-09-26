import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import RouteSkeleton from "./RouteSkeleton";

/**
 * Full-page loading placeholder used by the dashboard routes' `loading.tsx` files.
 *
 * ```tsx
 * // app/dashboard/earnings/loading.tsx
 * export default function Loading() {
 *   return <RouteSkeleton variant="stats" />;
 * }
 * ```
 */
const meta: Meta<typeof RouteSkeleton> = {
  title: "UI/RouteSkeleton",
  component: RouteSkeleton,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "inline-radio", options: ["stats", "form", "list", "cards"] },
    count: { control: { type: "number", min: 1, max: 9 } },
  },
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof RouteSkeleton>;

export const Stats: Story = { args: { variant: "stats" } };

export const Form: Story = { args: { variant: "form", count: 2 } };

export const List: Story = { args: { variant: "list", count: 5 } };

export const Cards: Story = { args: { variant: "cards", count: 6 } };
