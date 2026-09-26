import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HelpBanner from "./HelpBanner";

/** Call-to-action banner linking to the docs, shown at the bottom of the Platforms page. */
const meta: Meta<typeof HelpBanner> = {
  title: "Platforms/HelpBanner",
  component: HelpBanner,
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
type Story = StoryObj<typeof HelpBanner>;

export const Default: Story = {};

export const Loading: Story = { args: { isLoading: true } };
