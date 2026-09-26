# will-change guidelines

`will-change` tells the browser to promote an element to its own compositor
layer ahead of time, so an upcoming transform/opacity animation doesn't
trigger layout or paint. It's a strategic hint, not a free performance
boost — promoting a layer costs GPU memory, and leaving `will-change` set
after the animation is done keeps paying that cost for nothing.

## Two patterns used in this app

### 1. CSS-only, for repeated hover transforms

For elements that animate on `:hover` (a card image that scales, a bar that
slides up), add `will-change-transform` scoped to the hover state itself —
`hover:will-change-transform` or `group-hover:will-change-transform`. The
browser only keeps the layer promoted while the pointer is actually over
the element; it reverts automatically the moment hover ends, so there's no
manual cleanup to write.

```tsx
className="transition-transform group-hover:scale-105 group-hover:will-change-transform"
```

Used in `components/projects/ClipGrid.tsx` (the slide-up action bar),
`components/transform/StyleCard.tsx` (thumbnail hover-scale), and
`components/projects/ClipPreviewModal.tsx` (center play button).

### 2. JS-managed, for one-shot enter animations

Modals animate in once on mount (Tailwind `animate-in` classes) — there's
no hover state to scope `will-change` to. `app/hooks/useWillChange.ts`
sets `will-change` on mount and removes it on `animationend`/`transitionend`
(with a timeout fallback in case neither fires):

```tsx
const panelRef = useWillChange<HTMLDivElement>("transform, opacity");

<div ref={panelRef} className="animate-in zoom-in-95 duration-300">
```

Used in `ClipPreviewModal`, `ClipEditorModal`, and `BatchTransformModal`
for their panel enter animation.

### Static `will-change` — only for short-lived elements

`components/ui/ProgressBar.tsx` sets `will-change-transform` for its whole
mounted lifetime without cleanup. That's fine there specifically because
the element only exists while a file is uploading — it unmounts (and the
layer is released) shortly after, so there's no long-lived cost to clean
up. Don't copy this pattern onto anything that stays mounted indefinitely
(nav items, persistent cards, dashboard widgets) — use one of the two
patterns above instead.

## Adding a new candidate

1. Confirm the element actually animates `transform` and/or `opacity` —
   `will-change` for properties that trigger layout (`width`, `top`, …)
   doesn't help and should be avoided; animate those via `transform`
   instead.
2. If it's hover-triggered and repeats, use the CSS `group-hover:`/`hover:`
   pattern.
3. If it's a one-shot mount/unmount animation, use `useWillChange`.
4. Never add `will-change` to an element that isn't about to animate —
   "just in case" promotion is the anti-pattern this guide exists to avoid.
