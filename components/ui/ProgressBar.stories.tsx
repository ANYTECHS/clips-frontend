import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ProgressBar from "./ProgressBar";

/**
 * Compositor-friendly progress bar. The fill animates with `transform: scaleX`
 * rather than `width`, so many bars can animate at once without layout work.
 * Values outside 0–100 are clamped.
 *
 * ```tsx
 * <ProgressBar value={uploadPercent} label="Uploading video.mp4" />
 * ```
 */
const meta: Meta<typeof ProgressBar> = {
  title: "UI/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  args: { value: 45, label: "Upload progress" },
  argTypes: {
    value: { control: { type: "range", min: -10, max: 110, step: 1 } },
    durationMs: { control: { type: "number", min: 0, step: 50 } },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {};

export const Empty: Story = { args: { value: 0 } };

export const Complete: Story = { args: { value: 100 } };

export const Clamped: Story = {
  args: { value: 140 },
  parameters: { docs: { description: { story: "Out-of-range values render as 100%." } } },
};

export const CustomColours: Story = {
  args: {
    value: 70,
    className: "h-3 w-full rounded-full bg-red-500/10",
    fillClassName: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]",
  },
};
