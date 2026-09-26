# Storybook Component Documentation

This document provides information about the Storybook setup for ClipCash AI component documentation.

## 📚 Overview

Storybook is an open-source tool for building UI components and pages in isolation. It streamlines UI development, testing, and documentation.

**Live Storybook**: [Coming Soon - Will be deployed to Chromatic/Vercel]

## 🚀 Quick Start

### Running Storybook Locally

```bash
# Install dependencies
npm install

# Start Storybook development server
npm run storybook
```

Storybook will be available at: http://localhost:6006/

### Building Storybook

```bash
# Build static Storybook
npm run build-storybook
```

The static build will be output to `storybook-static/` directory.

## 📦 Components Documented

Every visual component has a story, grouped in the sidebar by title prefix. Stories tagged `autodocs` get a generated **Docs** page with a props table, the component's JSDoc description, and usage snippets.

| Group | Stories |
| --- | --- |
| **UI** | Skeleton, SkeletonCard, SkeletonTable, SkeletonPresets, RouteSkeleton, ProgressBar, ErrorUI |
| **Feedback** | OfflineBanner |
| **Common** | VirtualList |
| **Components** | Navbar, Footer, ErrorBoundary, RateLimitToast, LandingLayout |
| **Layout** | BackgroundOrbs |
| **Icons** | PlatformIcons (YouTube, TikTok, Instagram, Twitter, MetaMask, Phantom) |
| **Auth** | AuthForm |
| **Charts** | DonutChart, Sparkline, WalletCharts |
| **Clips** | ClipsNavbar, ClipsStats, CreateClipsForm, Hero |
| **Dashboard** | StatCard, ProjectCard, AIInsightCard, DashboardHeader, DashboardSidebar, EarningsSummaryCards, EarningsTable, PlanUsage, PlatformDistribution, RevenueChart, WalletInfoCard |
| **Platforms** | PlatformCard, SectionHeader, HelpBanner, PlatformsFooter |
| **Projects** | ClipEditorModal, ClipPreviewModal, MintConfigForm, ProjectFilters, ScoreBreakdownTooltip, SelectionFooter, TagsFilter |
| **Transform** | StyleCard, StylePicker, AnimeTransformControls, BatchTransformModal, BatchTransformQueue, ComparisonPlayer, TransformResult |
| **Vault** | NFTCard, NFTGrid |
| **Wallet** | AssetRow, TrustlineManager, WalletConnectButton, WalletHealthCard |
| **App** | NotFound |

### What does not get a story

Components that render no UI of their own have no story. They are exercised through the stories that use them or through Jest tests. This covers context providers (`AuthProvider`, `WalletProvider`, `MultiWalletProvider`, `EmbeddedWalletProvider`, `StellarWalletProvider`, `DataSyncProvider`, `AnalyticsProvider`, `theme-provider`) and side-effect-only components (`PerformanceMonitor`, `ResourceHints`, `DnsPrefetchHints`, `CryptoSaltInitializer`, `KeyboardShortcuts`). Files that only re-export another component are skipped too.

### Variants

Each story file exports one named story per meaningful state: default, loading, empty, error, disabled, and each value of a `variant`/`size`/`status` prop. For example, `Platforms/PlatformCard` covers NotLinked, Active, Connecting, ComingSoon, HorizontalWallet, HorizontalLinked and Skeletons.

### Usage examples

Put a usage snippet in the JSDoc comment above `meta`. It shows up on the component's Docs page:

```tsx
/**
 * Compositor-friendly progress bar.
 *
 * ```tsx
 * <ProgressBar value={uploadPercent} label="Uploading video.mp4" />
 * ```
 */
const meta: Meta<typeof ProgressBar> = { ... };
```

## 🎨 Storybook Features

### Addons Installed

1. **@chromatic-com/storybook** - Visual testing and review
2. **@storybook/addon-vitest** - Component testing integration
3. **@storybook/addon-a11y** - Accessibility testing
4. **@storybook/addon-docs** - Auto-generated documentation
5. **@storybook/addon-mcp** - Model Context Protocol integration

### Interactive Controls

All stories include interactive controls that allow you to:
- Modify component props in real-time
- Test different states and variants
- Copy code snippets
- View auto-generated documentation

### Accessibility Testing

Every component includes built-in accessibility checks:
- ARIA labels and roles
- Keyboard navigation
- Color contrast
- Screen reader compatibility

## 📁 File Structure

```
clips-frontend/
├── .storybook/
│   ├── main.ts           # Storybook configuration
│   └── preview.tsx       # Global decorators and parameters
├── components/
│   ├── dashboard/
│   │   ├── StatCard.tsx
│   │   └── StatCard.stories.tsx
│   ├── ui/
│   │   ├── StatusBadge.tsx
│   │   └── StatusBadge.stories.tsx
│   └── ...
└── stories/
    └── Introduction.mdx  # Storybook introduction page
```

## ✍️ Writing Stories

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import MyComponent from './MyComponent';

const meta = {
  title: 'Category/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    propName: {
      control: 'text',
      description: 'Description of the prop',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    propName: 'value',
  },
};
```

### Story Naming Convention

- Use PascalCase for story names
- Name stories after the variant they represent
- Examples: `Default`, `Loading`, `WithError`, `LargeSize`

### Categories

Stories are organized into categories:
- `Dashboard/` - Dashboard-specific components
- `UI/` - Generic UI components
- `Projects/` - Project management components
- `Vault/` - NFT vault components
- `Platforms/` - Social platform components
- `Wallet/` - Wallet integration components

## 🚢 Deployment

Storybook is deployed to **GitHub Pages** by [`.github/workflows/storybook.yml`](.github/workflows/storybook.yml):

1. Runs on every push to `main` (and manually via **Actions → Deploy Storybook to GitHub Pages → Run workflow**).
2. Installs dependencies with `npm ci` on Node 20.
3. Runs `npm run build-storybook`, which outputs to `storybook-static/`.
4. Uploads the folder with `actions/upload-pages-artifact` and publishes it with `actions/deploy-pages`.

The published URL is shown on the workflow run's `deploy` job and under **Settings → Pages**. It follows the pattern `https://<owner>.github.io/clips-frontend/`.

**One-time setup:** in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

**Environment:** `storybook build` loads `next.config.ts`, which runs `validateRequiredEnv()`. The workflow therefore sets non-secret placeholder values for the required variables. To build locally, either have a filled-in `.env.local` or export the same placeholders shown in the workflow.

**Before merging UI changes**, check that the build succeeds locally:

```bash
npm run build-storybook
npx http-server storybook-static   # optional: preview the static build
```

For visual regression review, the `@chromatic-com/storybook` addon is already installed. Publishing to Chromatic is optional and needs a `CHROMATIC_PROJECT_TOKEN` secret.

## 🧪 Testing with Storybook

### Visual Testing

Use Chromatic for visual regression testing:

```bash
npx chromatic --project-token=<token>
```

### Accessibility Testing

The a11y addon automatically checks for:
- Missing alt text
- Color contrast issues
- ARIA attribute problems
- Keyboard navigation issues

View results in the "Accessibility" panel.

### Component Testing

Use Vitest integration for component tests:

```bash
npx vitest
```

## 🎯 Best Practices

### Component Stories

1. **Show all variants** - Create stories for every state
2. **Use realistic data** - Use actual images and text
3. **Document props** - Add descriptions to argTypes
4. **Test interactions** - Include stories with user interactions
5. **Accessibility** - Always include ARIA labels

### Story Organization

1. **Group by feature** - Use categories that match your app structure
2. **Consistent naming** - Follow the naming convention
3. **Add descriptions** - Use MDX for complex documentation
4. **Include examples** - Show real-world usage

### Performance

1. **Lazy load images** - Use Next.js Image component
2. **Memoize components** - Use React.memo for expensive components
3. **Optimize stories** - Don't include unnecessary data

## 🔧 Configuration

### Tailwind CSS

Storybook is configured to use the project's Tailwind CSS:

```typescript
// .storybook/preview.tsx
import '../app/globals.css'
```

### Dark Theme

All components are displayed with dark background by default:

```typescript
parameters: {
  backgrounds: {
    default: 'dark',
    values: [
      { name: 'dark', value: '#050505' },
      { name: 'light', value: '#ffffff' },
    ],
  },
}
```

### Global Providers and Router Mock

`.storybook/preview.tsx` wraps every story in the app-wide providers, so components that use these hooks render without extra setup:

| Provider | Hooks it satisfies | Story value |
| --- | --- | --- |
| `SessionProvider` (next-auth) | `useSession()` | A static mock session (`storybook@example.com`). No network fetch. |
| `AuthProvider` | `useAuth()` | Derived from the mock session |
| `I18nProvider` | `useI18n()` | English |

`parameters.nextjs.appDirectory: true` mocks the App Router (`useRouter`, `usePathname`, `useSearchParams`). To set the current route for one story:

```tsx
export const OnEarnings: Story = {
  parameters: { nextjs: { navigation: { pathname: '/earnings' } } },
};
```

Providers that talk to real services (wallets, the data-sync layer) are **not** global. Mock them with props or a story-level decorator.

## 📖 Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook for Next.js](https://storybook.js.org/docs/get-started/frameworks/nextjs)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)

## 🤝 Contributing

When adding new components:

1. Create the component in the appropriate directory
2. Add a `.stories.tsx` file next to the component
3. Include at least 3 variants (default, loading, error)
4. Add interactive controls for all props
5. Test accessibility with the a11y addon
6. Document complex props with descriptions

## 📝 Changelog

### v1.0.0 (2026-05-26)
- Initial Storybook setup
- Added 11 core component stories
- Configured Tailwind CSS integration
- Added accessibility testing
- Created introduction documentation

## 🐛 Troubleshooting

### Storybook won't start

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run storybook
```

### Components not rendering

Check that:
1. Global CSS is imported in `.storybook/preview.tsx`
2. Component paths are correct
3. All dependencies are installed

### Build fails

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Build with verbose logging
npm run build-storybook -- --debug
```

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check existing stories for examples
- Refer to Storybook documentation

---

**Last Updated**: May 26, 2026
**Storybook Version**: 10.4.1
**Status**: ✅ Ready for deployment
