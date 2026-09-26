# Pull Request: Feature and Test Enhancements

## Summary of Changes

### Task 1: Fuzz Test File Upload Validation
- Closes #807 [TEST] Fuzz Test File Upload Validation
- Added `fast-check` property-based fuzz testing suite in `tests/fuzz/upload.fuzz.test.ts`.
- Validates random file names, extensions, declared MIME types, magic byte headers, and 500 MB boundary file sizes across 1000 generated cases.

### Task 2: Add Playwright Visual Regression Tests
- Closes #808 [TEST] Add Playwright Visual Regression Tests
- Added visual regression testing suite in `tests/e2e/visual.spec.ts`.
- Configured snapshot baseline path `tests/visual-baselines/` and max diff pixel ratio threshold of 1% (`maxDiffPixelRatio: 0.01`).
- Added NPM scripts `test:visual` and `test:visual:update`.
- Captures visual baselines for dashboard, projects (with clips), wallet portfolio, and earnings table.

### Task 3: Add Clip Quality Score Breakdown Tooltip
- Closes #809 [FEAT] Add Clip Quality Score Breakdown Tooltip
- Extended clip data model with `scoreBreakdown: { hook: number, retention: number, emotional: number, trending: number }`.
- Updated AI backend callback schema and job store payload processing.
- Created `ScoreBreakdownTooltip` component showing mini bars for hook, retention, emotional, and trending sub-scores.
- Made tooltip keyboard accessible (`tabIndex={0}`, focus/blur triggers, ARIA attributes).
- Added Storybook story in `components/projects/ScoreBreakdownTooltip.stories.tsx`.

### Task 4: Add StellarWalletProvider and EmbeddedWalletProvider Components
- Closes #810 [FEAT] Add StellarWalletProvider and EmbeddedWalletProvider Components
- Created `EmbeddedWalletProvider` exposing `{ wallet, isLoading, error }` context and `useEmbeddedWallet` hook.
- Updated `StellarWalletProvider` to call `CryptoSaltInitializer` on mount and wrap children in `EmbeddedWalletProvider`.
- Ensured SSR safety on both providers.
- Created comprehensive unit tests in `__tests__/components/StellarWalletProvider.test.tsx` verifying wallet creation and retrieval.

## Code Review Checklist (additions)

- Naming conventions: ensure files, components, types, variables, and hooks follow the project's naming conventions (see `docs/naming-conventions.md`).
	- Files: kebab-case
	- Components/Types: PascalCase
	- Variables/Functions: camelCase
	- Hooks: start with `use`

