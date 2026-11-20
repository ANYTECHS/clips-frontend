import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: { default: "app", values: [{ name: "app", value: "#020D08" }] },
    layout: "centered",
  },
};

export default preview;
