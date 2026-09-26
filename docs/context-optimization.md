# Context optimization

## The problem

`WalletProvider` (`components/wallet/WalletProvider.tsx`) exposed a single
context whose value was `{ ...state, connectMetaMask, connectPhantom, ... }`
— a brand-new object built on every render, bundling seven state fields with
six action callbacks. Any consumer of `useWallet()`, no matter which part it
actually read, re-rendered on **every** wallet state change: a page that
only needed `connectStellar` to run one action re-rendered on every
`isConnecting` flicker; a page that only displayed `address` re-rendered
when an unrelated `error` was set and cleared.

`disconnect` made this worse on its own: it depended on `state.walletType`,
so its identity changed on every wallet state update — which meant even a
consumer that only used `disconnect` couldn't get a stable reference to hand
to a memoized child.

`app/context/NetworkContext.tsx` was also reviewed. Its value object
(`{ network, setNetwork }`) is rebuilt every render same as any context, but
`network` changes rarely (a user-initiated toggle, or a cross-tab storage
event) and it has few consumers, so it wasn't worth the same treatment here.

## The fix

Two independent techniques, applied together in `WalletProvider`:

### 1. Context splitting

State and actions now live in **separate contexts** — `walletStateStore`
(state) and `WalletActionsContext` (actions). `disconnect` was changed to
read the current wallet type through a ref (`stateRef.current.walletType`)
instead of a dependency, so every action callback now has a stable,
never-changing identity, and the actions object built from them (`useMemo`)
never changes reference either. A consumer that only needs to call an
action — `useWalletActions()` — never re-renders when wallet state changes.

### 2. Context selector optimization

The state context is created with `app/lib/createSelectableContext.tsx`
rather than a plain `createContext`. Its `useSelector` subscribes to a
*derived slice* of the state via `useSyncExternalStore`, re-rendering only
when that slice changes (`Object.is` by default, or a custom `isEqual`):

```tsx
// Re-renders whenever *any* wallet state field changes.
const { address, walletType, isConnected } = useWallet();

// Re-renders only when address/walletType/isConnected actually change.
const { address, walletType, isConnected } = useWalletSelector(
  (s) => ({ address: s.address, walletType: s.walletType, isConnected: s.isConnected }),
  shallowEqual, // compares the returned object's own keys
);

// Never re-renders on wallet state changes at all.
const { importStellarKey, connectStellar } = useWalletActions();
```

`useWallet()` still exists and returns the full combined shape, unchanged
in behavior, for call sites that genuinely need most of it — `app/hooks/useMultiWalletConnection.ts`
and `components/wallet/TransactionHistoryViewer.tsx` were left as-is since
they read state across most of the object already, so a selector wouldn't
narrow much. `app/(dashboard)/multisig/page.tsx` (reads three state fields)
and `app/recovery/page.tsx` (reads only actions) were migrated as examples.

## `createSelectableContext` reuse

`app/lib/createSelectableContext.tsx` is generic — reach for it when a
single context value changes as a whole (one state object) and some
consumers only care about part of it:

```ts
const userStore = createSelectableContext<UserState>("User");

// Provider
<userStore.Provider value={userState}>{children}</userStore.Provider>

// Consumer
const displayName = userStore.useSelector((s) => s.displayName);
```

For a context made of genuinely independent pieces (state vs. stable
callbacks, or two unrelated state slices that update separately), split
into separate `createContext`s instead, as `WalletActionsContext` does —
`createSelectableContext` only helps within a single value.

## Testing

- `__tests__/lib/createSelectableContext.test.tsx` — a selector consumer
  re-renders only when its slice changes; `useSelector` throws outside its
  `Provider`; `shallowEqual` behavior.
- `__tests__/components/WalletProvider.contextOptimization.test.tsx` — an
  actions-only consumer and an address-selector consumer don't re-render
  when an unrelated field (`error`) changes, while `useWallet()` still does;
  `useWalletActions()` stays referentially stable across wallet state
  changes.
- `__tests__/components/WalletProvider.test.tsx` (pre-existing) — covers
  `useWallet()`'s connect/disconnect/persistence behavior, unchanged.
