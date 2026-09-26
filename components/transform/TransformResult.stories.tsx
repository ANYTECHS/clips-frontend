import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TransformResult } from "./TransformResult";

const meta: Meta<typeof TransformResult> = {
  title: "Transform/TransformResult",
  component: TransformResult,
  tags: ["autodocs"],
  argTypes: {
    onShare: { action: "share_clicked" },
    styleName: { control: "text" },
    shareLink: { control: "text" },
  },
  args: {
    onShare: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TransformResult>;

/**
 * Mock video URLs for demo purposes. In production, these would be real
 * uploaded clip URLs or pre-signed URLs from cloud storage.
 */
const MOCK_ORIGINAL_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ForBiggerBlazes.mp4";
const MOCK_TRANSFORMED_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4";

/**
 * Default story: Anime style transformation without share link.
 * User can click "Share Comparison" to generate a link.
 */
export const Default: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "Anime",
    shareLink: null,
  },
};

/**
 * Story with an already-generated share link.
 * Demonstrates the filled state of the share dialog.
 */
export const WithShareLink: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "Anime",
    shareLink: "https://clipcash.ai/share/transform_abc123def456",
  },
};

/**
 * Cinematic style transformation example.
 */
export const Cinematic: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "Cinematic",
    shareLink: null,
  },
};

/**
 * Sketch style transformation example.
 */
export const Sketch: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "Sketch",
    shareLink: "https://clipcash.ai/share/transform_sketch_789xyz",
  },
};

/**
 * Watercolor style with emoji watermark.
 */
export const Watercolor: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "🎨 Watercolor",
    shareLink: null,
  },
};

/**
 * Interactive story that logs share events.
 * Useful for testing the share functionality.
 */
export const Interactive: Story = {
  args: {
    originalUrl: MOCK_ORIGINAL_VIDEO,
    transformedUrl: MOCK_TRANSFORMED_VIDEO,
    styleName: "Anime",
    shareLink: null,
    onShare: fn().mockImplementation(() => {
      console.log("Share clicked - in a real app this would generate a link");
    }),
  },
};
