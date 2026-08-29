/**
 * __tests__/utils/leakDetection.ts
 *
 * Shared helper for "does this leak a timer" tests. `jest.getTimerCount()`
 * (Jest's count of pending fake timers) is the sharpest tool available here:
 * an untracked `setTimeout`/`setInterval` shows up directly as a nonzero
 * delta instead of needing to infer it from side effects.
 *
 * Requires `jest.useFakeTimers()` to already be active in the calling test.
 * See `__tests__/components/ClipEditorModal.leak.test.tsx` and
 * `ToastProvider.leak.test.tsx` for the regression tests this generalizes.
 */

interface Unmountable {
  unmount: () => void;
}

/**
 * Renders via `render`, runs `interact` against the result, unmounts, and
 * asserts that whatever timers `interact` caused to be scheduled were
 * cleaned up by unmount rather than left pending.
 */
export async function expectNoLeakedTimers<T extends Unmountable>(
  render: () => T,
  interact: (result: T) => void | Promise<void>,
): Promise<void> {
  const baseline = jest.getTimerCount();
  const result = render();

  await interact(result);

  result.unmount();
  expect(jest.getTimerCount()).toBe(baseline);
}
