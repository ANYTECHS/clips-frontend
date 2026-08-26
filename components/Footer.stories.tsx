import type { Meta, StoryObj } from "@storybook/react";
import Footer from "./Footer";

const meta = {
  title: "Components/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default Footer as shown on all public pages (/, /login, /onboarding).
 * Includes the ClipCash logo, Privacy / Terms / Cookies / GitHub links,
 * and a copyright notice. Fully responsive — stacks vertically on narrow screens.
 */
export const Default: Story = {};
