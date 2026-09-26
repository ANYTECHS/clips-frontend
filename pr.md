## Summary

- **#943 Remove code duplication**: Consolidated duplicate AuthForm component (was duplicated in same file), removed shadowing `hooks/useToast.tsx` re-export that conflicted with the full implementation in `hooks/useToast.ts`, fixed `useSortQueryState.ts` which was an exact copy of `useFilterQueryState.ts` (now properly handles sort state), and made `ErrorBoundary` reuse `ErrorUI` instead of duplicating the error markup.

- **#942 Implement consistent file structure**: Added barrel exports (`index.ts`) for 8 directories that were missing them: `components/transform/`, `components/projects/`, `components/dashboard/`, `components/clips/`, `components/platforms/`, `components/vault/`, `components/common/`, and `hooks/`. Updated the incomplete `components/index.ts` to re-export all subdirectories. Updated `components/wallet/index.ts` and `components/ui/index.ts` to export all their members.

- **#941 Add code documentation**: Added JSDoc comments to 12 complex components/functions including `ClipGrid`, `AuthForm`, `StatCard`, `WalletInfoCard`, `AIInsightCard`, `DashboardHeader`, `ExportDropdown`, `StylePicker` (`useStyles` hook), `PrivacySettings`, `MintConfigForm`, `CreateClipsForm`, `ActivityFeed`, and `TrustlineManager`.

- **#940 Implement consistent error handling**: Created `app/lib/errorHandling.ts` with shared utilities (`getErrorMessage`, `safeAsync`, `handleApiResponse`) for standardized error handling across the codebase. Fixed `useUndoRedo` reactivity bug where `canUndo`/`canRedo` read from `useRef` directly and never triggered re-renders (now uses reactive `useState`).

Closes #943, Closes #942, Closes #941, Closes #940
