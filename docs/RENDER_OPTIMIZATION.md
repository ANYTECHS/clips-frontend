# Render optimization patterns

How we keep React re-renders cheap (issue #1180).

## Unnecessary re-renders found

| Source | Problem | Fix |
| --- | --- | --- |
| `ThemeProvider`, `AuthProvider`, `ToastProvider`, `NetworkProvider`, `I18nProvider` | Context `value={{ ... }}` built a new object every render, so **every consumer** re-rendered whenever the provider did — even when nothing it read had changed. These sit at the root of `app/layout.tsx`, so this hit the whole app. | `value` wrapped in `useMemo`; callbacks inside it (`setTheme`, `toggleTheme`) wrapped in `useCallback` so the memo deps stay stable. |
| `ClipGrid` | Large list re-rendering on parent state changes. | Already `React.memo` + virtualised; parent handlers are `useCallback`. |

## Patterns

1. **Memoize context values.** Never pass an inline object/array to a
   `Context.Provider`. Use `useMemo` with every field as a dependency, and
   make any functions in it `useCallback`.
2. **Split context by update frequency.** If some consumers only need a
   setter, put it in its own context (see `app/lib/createSelectableContext.tsx`)
   so they don't re-render on value changes.
3. **`React.memo` for heavy leaf/list components** whose props are mostly
   stable (`ClipGrid`, rows in long lists). It only helps if the parent passes
   stable props, so pair it with rule 4.
4. **`useCallback` for handlers passed to memoized children**, `useMemo` for
   derived arrays/objects passed as props. Don't memoize cheap values that
   aren't passed down — it costs more than it saves.
5. **Keep state local.** Lift state only as far as the nearest common parent.

## Profiling

- **In production:** `useRenderTiming(name, deps)` (`app/hooks/useRenderTiming.ts`)
  reports `render.<name>` for a component; `<RenderProfiler id="...">`
  (`components/RenderProfiler.tsx`) wraps a whole subtree in React's
  `<Profiler>` and reports commits slower than 16ms. Both flow through
  `app/lib/performanceMonitoring.ts` — register a budget for the metric in
  `CUSTOM_METRIC_THRESHOLDS` so samples are rated.
- **Locally:** React DevTools → Profiler, with "Highlight updates when
  components render" enabled, to spot components re-rendering without
  prop changes.
