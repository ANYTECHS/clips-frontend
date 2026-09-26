"use client";

/**
 * Interactive feature tour (Issue #1065).
 *
 * Spotlights one element at a time and explains it. Built on the `data-tour`
 * attribute contract described in `app/lib/tutorial/types.ts`.
 *
 * # The spotlight
 *
 * Four dimming panels around the target rather than one overlay with a
 * transparent hole. A hole punched with `clip-path` or a huge `box-shadow`
 * blocks pointer events over the element it is meant to highlight, so the user
 * cannot interact with the thing being explained. Four panels leave the target
 * genuinely untouched.
 *
 * # Missing targets
 *
 * A step whose element is not on the page is skipped rather than shown against
 * nothing. Tours outlive the layouts they describe, and a tour that stalls on
 * a removed button is worse than one that is briefly shorter.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { StepPlacement, Tour } from "@/app/lib/tutorial/types";

/** Gap between the target and the tooltip. */
const OFFSET = 12;
/** Tooltip width; also the clamp width used when positioning. */
const PANEL_WIDTH = 320;
/** Minimum breathing room from the viewport edge. */
const EDGE = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(target: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;

  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;

  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/**
 * Place the panel beside the target, flipping and clamping to stay on screen.
 *
 * The preferred placement is a hint, not a guarantee: a step authored as
 * `right` against an element near the right edge would otherwise render
 * off-screen, which is exactly where a tour loses people.
 */
function positionPanel(
  rect: Rect,
  preferred: StepPlacement,
  panelHeight: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const fits: Record<StepPlacement, boolean> = {
    top: rect.top - panelHeight - OFFSET > EDGE,
    bottom: rect.top + rect.height + panelHeight + OFFSET < vh - EDGE,
    left: rect.left - PANEL_WIDTH - OFFSET > EDGE,
    right: rect.left + rect.width + PANEL_WIDTH + OFFSET < vw - EDGE,
  };

  const order: StepPlacement[] = [preferred, "bottom", "top", "right", "left"];
  const placement = order.find((p) => fits[p]) ?? "bottom";

  let top: number;
  let left: number;

  switch (placement) {
    case "top":
      top = rect.top - panelHeight - OFFSET;
      left = rect.left + rect.width / 2 - PANEL_WIDTH / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - panelHeight / 2;
      left = rect.left - PANEL_WIDTH - OFFSET;
      break;
    case "right":
      top = rect.top + rect.height / 2 - panelHeight / 2;
      left = rect.left + rect.width + OFFSET;
      break;
    default:
      top = rect.top + rect.height + OFFSET;
      left = rect.left + rect.width / 2 - PANEL_WIDTH / 2;
  }

  return {
    top: Math.min(Math.max(top, EDGE), vh - panelHeight - EDGE),
    left: Math.min(Math.max(left, EDGE), vw - PANEL_WIDTH - EDGE),
  };
}

export interface FeatureTourProps {
  tour: Tour;
  onComplete: () => void;
  onSkip: () => void;
}

export default function FeatureTour({ tour, onComplete, onSkip }: FeatureTourProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelPos, setPanelPos] = useState({ top: EDGE, left: EDGE });
  const panelRef = useRef<HTMLDivElement>(null);

  const step = tour.steps[index];
  const isLast = index === tour.steps.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Navigate before measuring, so a cross-page step measures on the right page.
  useEffect(() => {
    if (step?.route && window.location.pathname !== step.route) {
      router.push(step.route);
    }
  }, [step?.route, router]);

  // Measured in a layout effect so the panel never paints at a stale position.
  useLayoutEffect(() => {
    if (!step) return;

    let frame = 0;
    let attempts = 0;

    const measure = () => {
      const next = readRect(step.target);

      if (!next) {
        // Give a navigating or still-mounting target a few frames before
        // deciding it does not exist.
        attempts += 1;
        if (attempts < 30) {
          frame = requestAnimationFrame(measure);
          return;
        }
        // Genuinely absent — skip rather than stall.
        if (isLast) onComplete();
        else setIndex((i) => i + 1);
        return;
      }

      setRect(next);
      const panelHeight = panelRef.current?.offsetHeight ?? 180;
      setPanelPos(positionPanel(next, step.placement ?? "bottom", panelHeight));
    };

    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [step, isLast, onComplete]);

  // Re-measure on scroll and resize: an anchored panel that does not follow its
  // target is worse than no panel.
  useEffect(() => {
    if (!step || !rect) return;

    const remeasure = () => {
      const next = readRect(step.target);
      if (!next) return;
      setRect(next);
      const panelHeight = panelRef.current?.offsetHeight ?? 180;
      setPanelPos(positionPanel(next, step.placement ?? "bottom", panelHeight));
    };

    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [step, rect]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSkip, goNext, goBack]);

  if (!step || !rect) return null;

  const dim = "fixed bg-black/70 z-[60] pointer-events-auto";

  return (
    <>
      {/* Four panels, not a punched hole — see the note at the top. */}
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: rect.top }} onClick={onSkip} />
      <div
        className={dim}
        style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
        onClick={onSkip}
      />
      <div
        className={dim}
        style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
        onClick={onSkip}
      />
      <div
        className={dim}
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          right: 0,
          height: rect.height,
        }}
        onClick={onSkip}
      />

      {/* Highlight ring. `pointer-events-none` so it never intercepts a click
          meant for the element it outlines. */}
      <div
        className="fixed z-[61] rounded-xl ring-2 ring-brand pointer-events-none transition-all duration-200"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-step-title"
        className="fixed z-[62] rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl"
        style={{ top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {tour.name} · {index + 1}/{tour.steps.length}
          </p>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip this tour"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 id="tour-step-title" className="mt-2 text-base font-bold text-white">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/70">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-white/40 transition-colors hover:text-white/70"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Previous step"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-brand-hover"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
