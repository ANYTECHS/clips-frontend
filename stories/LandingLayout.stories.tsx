import type { Meta, StoryObj } from "@storybook/react";
import LandingLayout from "@/components/LandingLayout";
import LandingHero from "@/components/LandingHero";

const meta = {
  title: "Components/LandingLayout",
  component: LandingLayout,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LandingLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default landing layout with full hero section including URL form and social proof.
 * This is the layout used on the home page (/).
 */
export const Default: Story = {
  args: {
    hero: <LandingHero />,
    showAuthLoadingSkeleton: false,
    authFormMode: "login",
  },
};

/**
 * Landing layout with auth loading skeleton.
 * Shows animated skeleton while auth state is initializing.
 * This is used on the home page (/) to prevent flash of login form.
 */
export const WithAuthLoadingSkeleton: Story = {
  args: {
    hero: <LandingHero />,
    showAuthLoadingSkeleton: true,
    authFormMode: "login",
  },
};

/**
 * Login page variant without social proof section.
 * Simplified hero focused on authentication.
 */
export const LoginVariant: Story = {
  args: {
    hero: (
      <LandingHero
        badgeText="SIGN IN TO YOUR ACCOUNT"
        heading={
          <>
            Welcome <span className="text-brand">Back</span>
          </>
        }
        description="Access your dashboard and manage your video clips."
        showUrlForm={true}
        showSocialProof={false}
      />
    ),
    showAuthLoadingSkeleton: false,
    authFormMode: "login",
  },
};

/**
 * Signup page variant with custom heading.
 * Shows signup-specific messaging.
 */
export const SignupVariant: Story = {
  args: {
    hero: (
      <LandingHero
        badgeText="CREATE YOUR ACCOUNT"
        heading={
          <>
            Get Started with <span className="text-brand">ClipCash</span>
          </>
        }
        description="Join thousands of creators turning long videos into viral clips. Start for free."
        showUrlForm={false}
        showSocialProof={true}
      />
    ),
    showAuthLoadingSkeleton: false,
    authFormMode: "signup",
  },
};

/**
 * Minimal variant with custom styling and no URL form.
 * Useful for focused landing pages.
 */
export const Minimal: Story = {
  args: {
    hero: (
      <LandingHero
        heading="Simple and Clean"
        description="A minimal landing layout perfect for focused messaging."
        showUrlForm={false}
        showSocialProof={false}
      />
    ),
    showAuthLoadingSkeleton: false,
    authFormMode: "login",
  },
};

/**
 * Full-featured variant with all sections enabled.
 * Demonstrates the complete landing experience.
 */
export const FullFeatured: Story = {
  args: {
    hero: (
      <LandingHero
        badgeText="FEATURED RELEASE"
        heading={
          <>
            Transform Your
            <br />
            Video Content
            <br />
            with <span className="text-brand">AI Power</span>
          </>
        }
        description="Upload once, create hundreds of clips. Our AI automatically finds the best moments for maximum engagement across all platforms."
        showUrlForm={true}
        showSocialProof={true}
      />
    ),
    showAuthLoadingSkeleton: false,
    authFormMode: "login",
  },
};

/**
 * Comparison: Before (duplicate code) and After (LandingLayout).
 * Demonstrates how LandingLayout eliminates duplication.
 */
export const BeforeAfter: Story = {
  render: () => (
    <div className="space-y-8 bg-slate-900 p-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Landing Layout - Unified Component</h2>
        <p className="text-gray-300 mb-4">
          This single LandingLayout component eliminates ~400 lines of duplicated code between
          the home page (/) and login page (/login). Bug fixes and style changes now apply everywhere.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">✓ Before (Duplicated)</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>❌ 200+ lines in app/page.tsx</li>
            <li>❌ 180+ lines in app/login/page.tsx</li>
            <li>❌ Duplicate: Navbar, Footer, background orbs</li>
            <li>❌ Duplicate: Auth form, layouts, styling</li>
            <li>❌ Bug fixes applied twice (manual sync)</li>
            <li>❌ Hard to maintain style consistency</li>
          </ul>
        </div>

        <div className="bg-green-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">✓ After (Unified)</h3>
          <ul className="text-sm text-white space-y-2">
            <li>✓ 5 lines in app/page.tsx</li>
            <li>✓ 5 lines in app/login/page.tsx</li>
            <li>✓ Shared: LandingLayout + LandingHero</li>
            <li>✓ Props-based customization</li>
            <li>✓ Bug fixes applied once</li>
            <li>✓ Consistent styling everywhere</li>
          </ul>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Code Reduction</h3>
        <pre className="text-xs text-gray-300 overflow-x-auto bg-slate-900 p-3 rounded">
{`// OLD: app/page.tsx (200+ lines)
export default function Home() {
  const [url, setUrl] = useState("");
  const [urlAnalyzing, setUrlAnalyzing] = useState(false);
  // ... 200+ lines of JSX
  return (
    <div className="min-h-screen ...">
      <Navbar />
      {/* duplicate background orbs */}
      {/* duplicate layout */}
      {/* duplicate auth form */}
      <Footer />
    </div>
  );
}

// NEW: app/page.tsx (5 lines)
export default function Home() {
  return (
    <LandingLayout
      hero={<LandingHero />}
      showAuthLoadingSkeleton={true}
      authFormMode="login"
    />
  );
}`}
        </pre>
      </div>
    </div>
  ),
};
