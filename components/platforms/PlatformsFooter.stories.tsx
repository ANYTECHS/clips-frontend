import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PlatformsFooter from "./PlatformsFooter";

/** OAuth consent and privacy notice shown beneath the platform connection cards. */
const meta: Meta<typeof PlatformsFooter> = {
  title: "Platforms/PlatformsFooter",
  component: PlatformsFooter,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlatformsFooter>;

export const Default: Story = {};

export const Loading: Story = { args: { isLoading: true } };
