# List virtualization

## Heavy lists identified

- **`components/wallet/ActivityFeed.tsx`** — renders every fetched Stellar
  transaction into a `<ul>`. Pages accumulate via "Load More" up to
  `MAX_HORIZON_PAGE_SIZE` (200) transactions kept in state at once, all
  mounted simultaneously.
- **`components/explore/ExploreFeed.tsx`** — an infinite-scroll clip grid
  that keeps appending pages (20 clips at a time) with no upper bound as the
  user scrolls, so a long session can accumulate hundreds of mounted clip
  cards (each with its own `<Link>`, image, and gradient overlays).

`components/dashboard/EarningsTable.tsx` was also reviewed but is
server-paginated (`pagination.pageSize` bounds what's rendered per page), so
it isn't a windowing candidate the way the two feeds above are.

## The fix

`components/common/VirtualList.tsx` and `VirtualGrid.tsx` render only the
rows near the viewport instead of the full item array, backed by
`app/hooks/useWindowVirtualizer.ts`.

- **`VirtualList`** — fixed-row-height vertical list. Used by `ActivityFeed`
  in place of `filteredTransactions.map(...)`.
- **`VirtualGrid`** — same idea for a responsive CSS-grid layout. Measures
  its own width with `ResizeObserver` to work out how many columns fit
  (falling back to a single column where `ResizeObserver` isn't available),
  then windows by row. Used by `ExploreFeed` in place of the clip grid's
  `.map(...)`.

Both window against **the page's scroll position**, not an inner scrollable
container — `getBoundingClientRect()` on the list's own wrapper tells the
hook how far it sits from the viewport, which is what these feeds need since
the page itself scrolls rather than a fixed-height box.

```tsx
<VirtualList
  items={filteredTransactions}
  itemKey={(t) => t.id}
  rowHeight={84}
  gap={8}
  renderItem={(t) => <TransactionRow transaction={t} />}
/>

<VirtualGrid
  items={clips}
  itemKey={(clip) => clip.id}
  rowHeight={320}
  minItemWidth={220}
  renderItem={(clip) => <ClipCard clip={clip} />}
/>
```

## Configuration

`app/lib/virtualizationConfig.ts` centralizes the shared defaults:

| Key | Default | Meaning |
| --- | --- | --- |
| `overscanPx` | 600 | Extra pixels rendered above/below the viewport, so fast scrolling doesn't reveal empty space before the next row mounts. |
| `virtualizeThreshold` | 30 | Rule-of-thumb item count above which a list is worth virtualizing at all — below it, the windowing overhead isn't worth it. |

Per-call-site knobs (passed as props, not global config, since they're
inherent to the content being laid out):

- `rowHeight` — required; rows are assumed fixed-height. Variable-height
  content should reserve `rowHeight` worth of space rather than growing past
  it, or the windowing math drifts.
- `gap` — spacing between rows, added into the row "stride" used for both
  positioning and the total-height calculation.
- `minItemWidth` (`VirtualGrid` only) — minimum width a cell needs before
  another column is added.

## Constraints

- Rows must be a known, fixed height. Neither component measures actual
  rendered row height — if content overflows `rowHeight`, rows will visually
  overlap.
- `VirtualGrid`'s column count is measured via `ResizeObserver` on its
  wrapper; environments without it (very old browsers, or a non-DOM test
  environment) fall back to a single column rather than failing to render.

## Testing

- `__tests__/hooks/useWindowVirtualizer.test.ts` — the windowing math itself
  (total height, viewport-relative range, empty-list edge case).
- `__tests__/components/VirtualList.test.tsx` /
  `__tests__/components/VirtualGrid.test.tsx` — confirm only a subset of a
  large item set is actually mounted, and that `VirtualGrid` degrades
  gracefully without `ResizeObserver`.
