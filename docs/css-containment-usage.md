# CSS containment usage

`contain` tells the browser that an element's internals are isolated from
the rest of the page, so a change inside it (a re-render, an animation)
doesn't force the browser to recheck layout/paint for its siblings or
ancestors. It's most valuable on elements that repeat — grid cards, list
rows — where the app can have dozens or hundreds mounted at once.

## The utility

`app/globals.css` defines:

```css
.contain-layout-style {
  contain: layout style;
}
```

`layout` is the containment that matters here (isolates layout). `style`
additionally scopes CSS counters. We deliberately don't include `paint`
(the third component of the `content` shorthand) — `contain: paint` also
clips overflowing content, the same way `overflow: hidden` does, which
would silently break anything that intentionally overflows its container
(a tooltip positioned `top-full`, a dropdown menu). `layout style` gets the
isolation benefit without that risk.

## Where it's applied

- `components/projects/ClipGrid.tsx` — each clip card in the virtualized
  grid.
- `components/vault/NFTCard.tsx` — each card in `NFTGrid`.
- `components/wallet/ActivityFeed.tsx` — each transaction row.

All three are self-contained: fixed-size cards/rows whose content never
needs to affect layout outside their own box, in lists that can grow to
tens or hundreds of items.

## What to avoid

- **Table rows.** `contain` has no effect on internal table display types
  (`table-row`, `table-cell`, …) in most browsers — don't add it to `<tr>`.
- **Elements with intentionally overflowing children.** Check for
  `absolute`-positioned descendants that extend past the container's
  bounds (tooltips, popovers) before adding containment — `layout style`
  is safe, but don't reach for `contain: paint`/`content` on those without
  checking first.
- **Anything that needs to size to its content in a way that depends on an
  ancestor** — layout containment establishes a new containing block,
  which is virtually always fine for a card/row but worth a second look for
  anything unusual (e.g. `position: fixed` children expecting the viewport
  as their containing block).

## Fallback

None needed. `contain` degrades gracefully — a browser that doesn't
support it (Safari < 15.4) just ignores the declaration and renders
exactly as it would have otherwise. There's no visual or functional
difference, only a missed optimization.

## Adding a new candidate

Add `contain-layout-style` to any repeated card/row wrapper once you've
confirmed nothing inside it needs to overflow the box. It's an additive
class — combine it with existing layout/spacing classes, e.g.:

```tsx
<div className="rounded-2xl overflow-hidden contain-layout-style ...">
```
