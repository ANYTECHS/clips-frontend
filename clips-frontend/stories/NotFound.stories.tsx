import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import NotFound from "../app/not-found";

/**
 * Stories for the custom 404 Not Found page (app/not-found.tsx).
 *
 * The page contains the shared Navbar which consumes the AuthContext.
 * Each story provides an appropriate mock via a decorator so the
 * Navbar renders correctly without the real AuthProvider (which depends
 * on Next.js router and localStorage).
 */

// ─── Auth context mock ────────────────────────────────────────────────────────
//
// We re-create the AuthContext shape here instead of importing it so the
// story doesn't pull in the full AuthProvider (which uses useRouter, which
// is only available inside a Next.js app).

import { createContext, useContext } from "react";
import type { User } from "../app/lib/mockApi";

interface AuthContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  isLoading: boolean;
}

// Mirror the default value from AuthProvider so the context shape matches.
const MockAuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: false,
});

// Patch the useAuth hook used by Navbar by providing the context through
// the same React context object that AuthProvider exposes.
// Because Storybook resolves modules from the project root, we can override
// the context value via a decorator that wraps the story with our mock provider.

/** Decorator factory — wraps the story with a mock AuthProvider value. */
function withMockAuth(user: User | null) {
  return function AuthDecorator(Story: React.ComponentType) {
    return (
      <MockAuthContext.Provider value={{ user, setUser: () => {}, isLoading: false }}>
        <Story />
      </MockAuthContext.Provider>
    );
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: "Pages/NotFound",
  component: NotFound,
  parameters: {
    /**
     * Use the dark background defined in preview.ts to match the app's
     * #080C0B background color, ensuring the story looks identical to prod.
     */
    backgrounds: { default: "dark" },
    /**
     * Disable the default padding added by the Storybook canvas so the
     * full-page layout renders edge-to-edge, just like in the browser.
     */
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Custom 404 page rendered by Next.js App Router when no route matches. " +
          "Includes the shared Navbar, a branded error state, and CTAs to return " +
          "to the dashboard or home page.",
      },
    },
  },
  // Disable Next.js router mocking warnings in Storybook console
  nextjs: {
    appDirectory: true,
  },
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Default: unauthenticated visitor lands on a 404 URL.
 * The Navbar shows Sign In / Get Started CTAs.
 */
export const LoggedOut: Story = {
  name: "Logged out (visitor)",
  decorators: [withMockAuth(null)],
};

/**
 * Authenticated user navigates to a non-existent route.
 * The Navbar shows the user's name in the account dropdown.
 */
export const LoggedIn: Story = {
  name: "Logged in (authenticated user)",
  decorators: [
    withMockAuth({
      id: "demo-user-1",
      email: "alex@example.com",
      name: "Alex Rivera",
      onboardingStep: 3,
      profile: { username: "alexrivera" },
    }),
  ],
};

/**
 * Mobile viewport — verifies the layout stacks correctly at 375px.
 */
export const Mobile: Story = {
  name: "Mobile (375px)",
  decorators: [withMockAuth(null)],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

/**
 * Tablet viewport — verifies the layout at 768px.
 */
export const Tablet: Story = {
  name: "Tablet (768px)",
  decorators: [withMockAuth(null)],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
