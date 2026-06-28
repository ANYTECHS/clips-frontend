import type { Preview } from "@storybook/nextjs";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    /**
     * Dark background to match the app's #080C0B base color.
     * This ensures all stories render against the correct background
     * instead of Storybook's default white.
     */
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#080C0B" },
        { name: "surface", value: "#101614" },
        { name: "light", value: "#ffffff" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Viewport presets for responsive testing
    viewport: {
      viewports: {
        mobile: { name: "Mobile (375)", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop (1280)", styles: { width: "1280px", height: "800px" } },
      },
      defaultViewport: "desktop",
    },
  },
};

export default preview;
