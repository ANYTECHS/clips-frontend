# app/hooks

React hooks used across the app. Each entry lists what it takes in, what it returns, and a minimal usage example.

### `useApiMutation`
- **Input:** `(mutationFn: (args: TArgs) => Promise<TResult>, options?: { invalidateTags?, onSuccess?, onError? })`
- **Output:** `{ mutate, mutateAsync, data, loading, error, reset }`
- **Use when:** performing a write (POST/PATCH/DELETE) and invalidating the cached reads it affects. See `DATA_FETCHING.md`.
```ts
const { mutate, loading } = useApiMutation(
  (title: string) => apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ title }) }),
  { invalidateTags: ["projects"] },
);
```

### `useApiQuery`
- **Input:** `(key: string | null, url: string | null, options?: { tags?, ttlMs?, retry?, ... })`
- **Output:** `{ data, loading, validating, error, refresh, invalidate }`
- **Use when:** fetching from an API route — the app's unified data-fetching hook (stale-while-revalidate cache + normalized errors). See `DATA_FETCHING.md`.
```ts
const { data, loading, error, refresh } = useApiQuery<Project[]>(cacheKey("/api/projects"), "/api/projects");
```

### `useAutoStellarWallet`
- **Input:** none
- **Output:** `AutoStellarWallet` — `{ status: "idle"|"ready"|"loading"|"error", ...wallet fields }`
- **Use when:** you need the auto-provisioned (embedded) Stellar wallet for the signed-in user.
```ts
const wallet = useAutoStellarWallet();
```

### `useBalance`
- **Input:** `UseBalanceOptions` (public key, network, poll interval, etc.)
- **Output:** `UseBalanceState` — `{ balance: Balance | null, assets: AssetBalance[], error: BalanceError | null, ... }`
- **Use when:** displaying an account's native + asset balances.
```ts
const { balance, assets, isLoading } = useBalance({ publicKey });
```

### `useBatchTransform`
- **Input:** none (call returned functions with `TransformOptions`)
- **Output:** `UseBatchTransformReturn` — submit/cancel functions plus batch job state
- **Use when:** kicking off or tracking a batch video transform job.
```ts
const { submitBatch, jobs } = useBatchTransform();
```

### `useDashboardData`
- **Input:** none
- **Output:** `{ data: DashboardData, isLoading, error, ... }`, backed by `useDashboardStore`
- **Use when:** rendering the dashboard summary (stats, revenue trend, recent projects).
```ts
const { data, isLoading } = useDashboardData();
```

### `useDebounce`
- **Input:** `(value: T, delay = DEBOUNCE_DEFAULT_DELAY_MS)`
- **Output:** the debounced `T`, updated only after `value` is stable for `delay` ms
- **Use when:** debouncing search/filter input before firing a request.
```ts
const debouncedQuery = useDebounce(query, 300);
```

### `useFeeSponsorship`
- **Input:** `operationCount: number = 1`
- **Output:** `FeeSponsorshipState` — sponsorship availability/status for the given operation count
- **Use when:** checking whether a transaction's fee can be sponsored before submitting.
```ts
const sponsorship = useFeeSponsorship(2);
```

### `useFilterQueryState`
- Re-exports the top-level `hooks/useFilterQueryState.ts`. Syncs filter state with the URL query string.
- **Use when:** a list/grid needs shareable, URL-persisted filters.

### `useIntersectionObserver`
- **Input:** `UseIntersectionObserverOptions` (`root`, `rootMargin`, `threshold`, `once`, `enabled`)
- **Output:** `{ ref, isIntersecting, entry }`
- **Use when:** viewport-based rendering or data fetching — attach `ref` to the element to watch. Backs `LazyRender`, `LazyImage`, and `useViewportFetch`.
```ts
const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ rootMargin: "200px" });
```

### `useKeyboardShortcuts`
- **Input:** `KeyboardShortcutsOptions` — callbacks for each registered shortcut (`onOpenSearch`, `onOpenUpload`, `onNavigateEarnings`, etc.)
- **Output:** none (attaches global `keydown` listener); `SHORTCUT_REGISTRY` is exported for rendering a shortcuts help panel
- **Use when:** wiring global keyboard shortcuts (⌘K search, ⌘U upload, Escape to close modals, etc.).
```ts
useKeyboardShortcuts({ onOpenSearch, onOpenUpload, onNavigateEarnings, onNavigateProjects, onNavigateVault, onCloseModals, onOpenShortcuts });
```

### `useMultiWalletConnection`
- **Input:** none
- **Output:** connection state + connect/disconnect helpers for multiple external wallets
- **Use when:** supporting connection to more than one external wallet provider.
```ts
const { connect, disconnect, wallets } = useMultiWalletConnection();
```

### `useNetworkOverride`
- **Input:** none
- **Output:** the effective Stellar network plus a setter, respecting any dev override
- **Use when:** a component/page needs to read or toggle testnet/mainnet in development.
```ts
const { network, setNetwork } = useNetworkOverride();
```

### `usePasskeyWallet`
- **Input:** none
- **Output:** `PasskeyWalletState` plus register/authenticate actions
- **Use when:** implementing WebAuthn/passkey-backed wallet auth.
```ts
const { status, register, authenticate } = usePasskeyWallet();
```

### `useProcessingStatus`
- **Input:** `(jobId: string | null, enabled = true, maxReconnectAttempts = 3)`
- **Output:** live job status (via SSE/polling with reconnect), progress, moments found, error info
- **Use when:** tracking a video transform job's progress screen.
```ts
const status = useProcessingStatus(jobId, true, 3);
```

### `useStellarTransaction`
- **Input:** none (call returned `submitTransaction` with operations)
- **Output:** `UseStellarTransactionState` — `status`, `result`, `error`
- **Use when:** submitting a Stellar transaction from a client component and tracking its lifecycle. See `useStellarTransaction.README.md` for details.
```ts
const { submitTransaction, status } = useStellarTransaction();
```

### `useToast`
- **Input:** none
- **Output:** `{ showToast(text, variant?), ToastEl }`
- **Use when:** showing a lightweight inline toast message from a component.
```ts
const { showToast, ToastEl } = useToast();
showToast("Saved!", "success");
```

### `useTransformStatus`
- **Input:** `(jobId: string | null, enabled = true, maxReconnectAttempts = 3)`
- **Output:** `{ stopPolling }` — SSE-first progress tracker that updates `transformStore.jobs[jobId]`
- **Use when:** tracking a single style-transform job (mirrors `useProcessingStatus`: SSE → reconnect → poll `GET /api/transform/[id]` every 3s).
```ts
const { stopPolling } = useTransformStatus(jobId, enabled);
```

### `useTrustline`
- **Input:** `UseTrustlineOptions` (optional network/asset overrides)
- **Output:** `{ status: TrustlineStatus, addTrustline, removeTrustline, error, result }`
- **Use when:** adding/removing a Stellar trustline from the UI.
```ts
const { addTrustline, status } = useTrustline();
```

### `useUndoRedo`
- **Input:** `initialState: T`
- **Output:** `{ state, set, undo, redo, canUndo, canRedo }`
- **Use when:** any editor-like UI needs undo/redo history (e.g. clip editor).
```ts
const { state, set, undo, redo } = useUndoRedo(initialClip);
```

### `useUploadProgress`
- **Input:** none
- **Output:** per-file upload progress map and `UploadResult` helpers
- **Use when:** rendering per-file progress bars during video upload.
```ts
const { files, uploadFile } = useUploadProgress();
```

### `useViewportFetch`
- **Input:** `(key: string | null, fetcher: () => Promise<T>, options?: UseViewportFetchOptions<T>)`
- **Output:** `{ ref, isIntersecting, data, loading, error, refresh, invalidate }`
- **Use when:** a below-fold widget shouldn't fetch its data until the user scrolls near it.
```ts
const { ref, data, loading } = useViewportFetch("/api/stats/secondary", () => apiFetch("/api/stats/secondary"));
```

### `useWalletConnection`
- **Input:** none
- **Output:** `UseWalletConnectionState` — `status: "disconnected"|"connecting"|"connected"|"error"`, connect/disconnect actions
- **Use when:** connecting a single external wallet (e.g. Freighter).
```ts
const { status, connect, disconnect } = useWalletConnection();
```

Note: `useSortQueryState.ts` and a second `useToast.ts` also exist at the top-level `hooks/` directory (outside `app/`) — prefer the `app/hooks` versions for new app code.
