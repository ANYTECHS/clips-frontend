# components

React components grouped by feature area. Storybook (`npm run storybook`) is the canonical demo environment for these — see `AGENTS.md` (no public demo pages in the App Router).

## Groups

| Group | Intended use |
|---|---|
| `auth/` | Sign-in/sign-up form and the `AuthProvider` session context wrapper. |
| `charts/` | Reusable chart primitives (`DonutChart`, `Sparkline`) used by dashboard/earnings views. |
| `clips/` | Landing/marketing surface for the clips product (navbar, hero, stats, create-clips form). |
| `dashboard/` | Authenticated dashboard UI — header, sidebar, stat cards, earnings table/summary, revenue chart, activity feed, project cards, wallet info. |
| `icons/` | Platform brand icons (Instagram, TikTok, Twitter, YouTube) as SVG React components. |
| `layout/` | Page-level layout scaffolding (landing layout, hero, background decoration). |
| `platforms/` | UI for connecting/managing social platform integrations. |
| `projects/` | Clip project management — grid, filters, editor/preview modals, mint config, selection footer. |
| `SocialRecoveryConfig/` | Guardian-based social account recovery configuration UI. |
| `transform/` | Style transform flows — style picker/cards and batch transform modal/queue. |
| `ui/` | Generic, feature-agnostic primitives (`ErrorUI`, `Skeleton`, `ToastProvider`). |
| `vault/` | NFT vault views — card, grid, sidebar, mint config form. |
| `wallet/` | Wallet connection and management — connect button, activity feed, asset rows, trustline manager, health card, wallet providers. |

## Top-level components

Cross-cutting providers and utilities that don't belong to a single feature group:

| Component | Purpose |
|---|---|
| `AnalyticsProvider.tsx` | Initializes `app/lib/analytics.ts` and wires cookie-consent updates. |
| `CookieConsent.tsx` | Cookie consent banner; drives analytics opt-in/out. |
| `CryptoSaltInitializer.tsx` | Ensures the client-side crypto salt is initialized before encryption utilities run. |
| `ErrorBoundary.tsx` | App-wide React error boundary. |
| `KeyboardShortcuts.tsx` | Renders/wires the global keyboard shortcuts registry (see `app/hooks/useKeyboardShortcuts`). |
| `LocaleSwitcher.tsx` | UI for switching the active i18n locale. |
| `RateLimitToast.tsx` | Listens for the `rate-limit-exceeded` event (from `app/lib/rateLimiter.ts`) and shows a toast. |
| `SendPaymentForm.tsx` | Form for sending a Stellar payment. |
| `StellarWalletProvider.tsx` | Context provider exposing Stellar wallet state to descendants. |
| `theme-provider.tsx` | Light/dark theme context provider. |
| `ToastProvider.tsx` | App-wide toast notification provider. |
| `WalletConnectButton.tsx` | Top-level wallet connect button (see also `wallet/WalletConnectButton.tsx`). |
| `WalletProvider.tsx` | Top-level wallet context provider (see also `wallet/WalletProvider.tsx`). |
