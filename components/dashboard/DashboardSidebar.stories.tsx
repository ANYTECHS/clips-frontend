import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import DashboardSidebar from "./DashboardSidebar";

// Mock next/navigation for Storybook — @storybook/nextjs-vite handles useRouter,
// but usePathname needs a parameter override via the nextjs addon.
const meta: Meta<typeof DashboardSidebar> = {
  title: "Dashboard/DashboardSidebar",
  component: DashboardSidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // Provide a default pathname via the Next.js Storybook addon
    nextjs: {
      navigation: {
        pathname: "/dashboard",
      },
    },
    backgrounds: {
      default: "dark",
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen bg-background text-white">
        <Story />
        {/* Simulated content area */}
        <main className="flex-1 p-8">
          <p className="text-muted text-sm">← Sidebar on the left</p>
        </main>
      </div>
    ),
  ],
  args: {
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state — sidebar open on /dashboard (active link highlighted) */
export const Open: Story = {
  name: "Open — active on Dashboard",
  args: {
    isOpen: true,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/dashboard" },
    },
  },
};

/** Sidebar closed (hidden off-screen on mobile, visible on desktop) */
export const Closed: Story = {
  name: "Closed (mobile)",
  args: {
    isOpen: false,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/dashboard" },
    },
    // Simulate mobile viewport
    viewport: { defaultViewport: "mobile1" },
  },
};

/** Active link on Earnings route */
export const ActiveEarnings: Story = {
  name: "Open — active on Earnings",
  args: {
    isOpen: true,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/earnings" },
    },
  },
};

/** Active link on Projects route */
export const ActiveProjects: Story = {
  name: "Open — active on Projects",
  args: {
    isOpen: true,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/projects" },
    },
  },
};

/** Active link on Settings (bottom nav) */
export const ActiveSettings: Story = {
  name: "Open — active on Settings",
  args: {
    isOpen: true,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/settings" },
    },
  },
};
