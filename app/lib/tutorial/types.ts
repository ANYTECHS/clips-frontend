/**
 * Tutorial and feature-tour definitions (Issue #1065).
 *
 * # Why steps target a `data-tour` attribute rather than a CSS selector
 *
 * A selector written against classnames breaks the first time someone changes
 * a layout, and breaks silently — the tour just points at nothing. A dedicated
 * attribute is a declared contract: grepping `data-tour="upload"` finds both
 * the step and the element it anchors to, so a component being moved or
 * deleted is visible to whoever is doing the moving.
 */

export type TourId = "dashboard" | "create-clip" | "earnings";

export type StepPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  /** Value of the `data-tour` attribute on the element to highlight. */
  target: string;
  title: string;
  body: string;
  /** Preferred side; the tour flips it when there is no room. */
  placement?: StepPlacement;
  /**
   * Route the step's target lives on. The tour navigates there before showing
   * it, so a tour can span pages instead of being trapped on one.
   */
  route?: string;
}

export interface Tour {
  id: TourId;
  name: string;
  /** One line shown before the tour starts, so it can be declined informed. */
  description: string;
  steps: TourStep[];
}

export interface TutorialProgress {
  /** Tours the user has finished. */
  completed: TourId[];
  /** Tours the user explicitly dismissed. Never auto-started again. */
  skipped: TourId[];
  /** Contextual tooltips already dismissed, by id. */
  dismissedTips: string[];
}

export const EMPTY_PROGRESS: TutorialProgress = {
  completed: [],
  skipped: [],
  dismissedTips: [],
};

/** Whether a tour should start on its own for this user. */
export function shouldAutoStart(progress: TutorialProgress, tourId: TourId): boolean {
  // Skipping is a decision, not a deferral. Re-offering a tour someone
  // dismissed is the fastest way to make them distrust every prompt.
  return !progress.completed.includes(tourId) && !progress.skipped.includes(tourId);
}
