import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ComparisonPlayer from "./ComparisonPlayer";

/**
 * Side-by-side player for the original clip and its AI-transformed version.
 * One button plays or pauses both videos together.
 */
const meta: Meta<typeof ComparisonPlayer> = {
  title: "Transform/ComparisonPlayer",
  component: ComparisonPlayer,
  tags: ["autodocs"],
  args: {
    originalSrc: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    transformedSrc: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ComparisonPlayer>;

export const Default: Story = {};
