import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import Navbar from "./Navbar";
import { AuthProvider } from "@/components/auth/AuthProvider";

// ─── Mock sessions ─────────────────────────────────────────────────────────────

const SESSION_AUTHENTICATED: Session = {
  expires: "2099-01-01",
  user: {
    email: "alex@example.com",
    name: "Alex Johnson",
    image: null,
  },
};

// ─── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: "Components/Navbar",
  component: Navbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    // AuthProvider reads from useSession internally; wrap with SessionProvider
    // so auth state resolves correctly in Storybook without a real backend.
    (Story, { parameters }) => {
      const session: Session | null = parameters.mockSession ?? null;
      return (
        <SessionProvider session={session}>
          <AuthProvider>
            <div className="bg-background min-h-screen">
              <Story />
            </div>
          </AuthProvider>
        </SessionProvider>
      );
    },
  ],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ───────────────────────────────────────────────────────────────────

/**
 * Visitor who is not signed in.
 * Shows the ClipCash logo and a green "Sign In" button.
 */
export const Unauthenticated: Story = {
  parameters: {
    mockSession: null,
  },
};

/**
 * Signed-in user.
 * Shows the logo and an avatar chip with the user's name.
 * Click the chip to open the dropdown with Dashboard and Sign Out links.
 */
export const Authenticated: Story = {
  parameters: {
    mockSession: SESSION_AUTHENTICATED,
  },
};

/**
 * Mobile viewport — unauthenticated.
 * Shows the hamburger icon. Click it to reveal the slide-in nav drawer.
 */
export const Mobile: Story = {
  parameters: {
    mockSession: null,
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

/**
 * Mobile viewport — authenticated.
 * The hamburger drawer shows the user's avatar, name, and navigation links.
 */
export const MobileAuthenticated: Story = {
  name: "Mobile (Authenticated)",
  parameters: {
    mockSession: SESSION_AUTHENTICATED,
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
