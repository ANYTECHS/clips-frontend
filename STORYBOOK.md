# Storybook Guide
- Authoring stories: create `*.stories.tsx` with meta/default export and variants.
- Accessibility: document `@storybook/addon-a11y` usage and review steps.

## Running
- `npm run storybook` — dev server on :6006; `npm run build-storybook` — static build.
- `components/shared/Button.stories.tsx` documents every `Button` variant (primary, secondary, outline, ghost, danger, link), size (sm, md, lg, icon) and state (loading, disabled, full width), plus a variant × size `Matrix` story.
