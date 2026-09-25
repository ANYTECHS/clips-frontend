# Supported viewports and breakpoints

Written while fixing the tablet layout break (Issue #1070), which happened
because two components disagreed about where "small screen" ends.

## Breakpoints

Tailwind defaults, used as follows:

| Token  | Min width | What it means here |
|--------|-----------|--------------------|
| —      | 0         | Phone portrait. Single column, off-canvas sidebar. |
| `sm:`  | 640px     | Phone landscape / small tablet portrait. Padding and type step up. |
| `md:`  | 768px     | Tablet portrait. Content grids go two-up. **The sidebar is still off-canvas.** |
| `lg:`  | 1024px    | Tablet landscape / laptop. Sidebar becomes static and takes layout width. |
| `xl:`  | 1280px    | Desktop. Widest content grids. |

## The rule that was broken

**`lg` is the only breakpoint that may change the shell.** The sidebar is
`fixed` and off-canvas below `lg` and `sticky` at `lg` and up, so anything that
assumes horizontal room freed by the sidebar — a header row, a wide popover, a
three-column grid — must also be gated on `lg`, not `md`.

Issue #1070 was two violations of that rule:

1. `DashboardHeader` accepted an `onMenuClick` prop and never rendered a
   control for it. Below `lg` the sidebar sits at `-translate-x-full` with its
   only close button inside itself, so from 0–1023px there was no way to open
   navigation at all. It went unnoticed on phones because the layout is
   single-column and usable without the sidebar; on a tablet the dashboard
   looks like it should have navigation, and does not.
2. The header switched to `flex-row` at `md`. Between 768px and 1023px that put
   a `text-3xl` heading and the full action cluster on one ~720px line, and
   they overlapped. It now stacks until `lg`.

## Touch targets

Interactive controls are at least **44×44 px** (`h-11 w-11`), per the WCAG 2.5.5
target size guidance. The sidebar close button and the new header menu button
are both sized this way; icon-only buttons should not use padding alone to
reach the size, because the padding collapses with the icon's own line box.

## Devices this is checked against

| Device | Portrait | Landscape |
|--------|----------|-----------|
| iPhone SE / small Android | 375×667 | 667×375 |
| iPad mini | 768×1024 | 1024×768 |
| iPad Air / Pro 11" | 820×1180 | 1180×820 |
| iPad Pro 12.9" | 1024×1366 | 1366×1024 |

768×1024 and 820×1180 are the two that matter most: both sit inside the
`md`–`lg` band where the shell is mid-transition, and both are where #1070
reproduced.
