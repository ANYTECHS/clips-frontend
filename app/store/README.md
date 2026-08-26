# app/store

Zustand stores for client-side state that's shared across components. All stores are re-exported from `app/store/index.ts` — prefer importing from there. Shared shapes live in `app/store/types.ts`.

## `useDashboardStore` (`dashboardStore.ts`)
- **State (`DashboardState`):** `stats: DashboardStats | null`, `revenueTrend: RevenuePoint[]`, `recentProjects: Project[]`, `lastFetchedAt: number | null`, `loading: boolean`, `error: string | null`
- **Actions:** `fetchDashboard()`, `invalidateCache()`, `setRecentProjects(projects)`
- **Consumed by:** [`useDashboardData`](../hooks/README.md) hook, which the dashboard page reads through.
- **Selectors:** `selectStats`, `selectRevenueTrend`, `selectRecentProjects`, `selectDashboardMeta`

## `useEarningsStore` (`earningsStore.ts`)
- **State (`EarningsState`):** `totalEarnings`, `totalTrend`, `trendLabel`, `totalFiat`, `cryptoRevenue`, `pendingPayouts`, `breakdown: EarningsBreakdownItem[]`, `lastFetchedAt`, `loading`, `error`
- **Actions:** `fetchEarnings()`, `invalidateEarningsCache()`
- **Consumed by:** `components/dashboard/EarningsSummaryCards.tsx`, `components/dashboard/DashboardHeader.tsx`
- **Selectors:** `selectEarningsTotals`, `selectEarningsBreakdown`, `selectEarningsMeta`

## `useProcessStore` (`processStore.ts`)
- **State (`ProcessState`):** `id`, `label`, `progress` (0–100), `status: "idle"|"processing"|"complete"|"error"`, `startedAt`, `completedAt`, `momentsFound`, `estimatedSecondsRemaining`, `hasHydrated`
- **Actions:** `startProcess(id, label)`, `update(patch)`, `resetProcess()`
- **Consumed by:** [`useProcessingStatus`](../hooks/README.md) hook and `app/(dashboard)/dashboard/processing/page.tsx`
- **Selectors:** `selectProcess`, `selectProcessStatus`, `selectProcessProgress`, `selectHasHydrated`
- Persists to storage; `hasHydrated` guards against rendering stale defaults before rehydration completes.

## `useTransformStore` (`transformStore.ts`)
- **State (`TransformState`):** map of `TransformJob` (`id`, `status: TransformStatus`, progress, etc.) keyed by job id
- **Consumed by:** [`useBatchTransform`](../hooks/README.md), [`useTransformStatus`](../hooks/README.md), `app/(dashboard)/transform/[id]/page.tsx`
- **Selectors:** `selectAllJobs`, `selectJobById`, `selectActiveJob`, `selectTransformHasHydrated`

## `useUserStore` (`userStore.ts`)
- **State (`UserState`):** `profile: UserProfile | null`, `loading: boolean`, `error: string | null`
- **Actions:** `fetchUser()`, `setProfile(profile)`, `clearUser()`, `onPlanChange(callback)`
- **Consumed by:** `components/dashboard/DashboardHeader.tsx`
- **Selectors:** `selectUserProfile`, `selectUserName`, `selectUserEmail`, `selectUserAvatar`, `selectPlanUsage`, `selectUserLoading`

## Other files
- `api.ts` — re-exports API-related helpers used by the stores' `fetch*` actions.
- `types.ts` — shared state/action interfaces for all stores above (no store logic).

## API Barrel Pattern with Jest Mocking

The `api.ts` file serves as a barrel export for API functions used by stores. In production, it re-exports real implementations from `../lib/apiClient.ts`. In test environments, Jest automatically uses the mock at `__mocks__/app/store/api.ts`.

### How It Works

1. **Production**: `app/store/api.ts` re-exports real API functions from `app/lib/apiClient.ts`
2. **Tests**: Jest's automatic module resolution finds `__mocks__/app/store/api.ts` and uses it instead
3. **No manual mocking needed**: Store tests simply import from `./api` and get mocks automatically

### Example Usage in Tests

```typescript
// In a store test file
import { fetchDashboardFromAPI } from "./api";

// Jest automatically uses the mock from __mocks__/app/store/api.ts
// No jest.mock() call needed
```

### Adding New API Functions

When adding new API functions to `api.ts`:
1. Add the export to `app/store/api.ts`
2. Add a corresponding mock implementation to `__mocks__/app/store/api.ts`
3. Ensure the mock returns deterministic, predictable data for testing
