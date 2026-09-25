import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { I18nProvider } from "../app/lib/i18n/I18nProvider";
import { AuthProvider } from "../components/auth/AuthProvider";

// Static session so components using useSession()/useAuth() render without a
// NextAuth backend. Passing it to SessionProvider skips the initial fetch.
const mockSession: Session = {
  user: { name: "Storybook User", email: "storybook@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};

const preview: Preview = {
  parameters: {
    // Mock the App Router (useRouter / usePathname / useSearchParams) for
    // components that read navigation state.
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#050505",
        },
        {
          name: "light",
          value: "#ffffff",
        },
      ],
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  decorators: [
    // App-wide providers that components read from via hooks
    // (useSession, useAuth, useI18n).
    (Story) => (
      <SessionProvider session={mockSession} refetchOnWindowFocus={false}>
        <AuthProvider>
          <I18nProvider>
            <div className="min-h-screen bg-background text-white p-8">
              <Story />
            </div>
          </I18nProvider>
        </AuthProvider>
      </SessionProvider>
    ),
  ],
};

export default preview;
