"use client";

/**
 * Tour list and replay control (Issue #1065).
 *
 * The AC asks for skippable tutorials, which only works if there is a way
 * back: skipping is safe to offer precisely because this exists. Drop it in
 * settings or a help menu.
 */

import { CheckCircle2, Play, RotateCcw, SkipForward } from "lucide-react";
import { TOUR_ORDER, TOURS } from "@/app/lib/tutorial/tours";
import { useTutorial } from "./TutorialProvider";

export default function TutorialLauncher() {
  const { completed, skipped, startTour, resetTutorials } = useTutorial();

  return (
    <section className="space-y-3" aria-labelledby="tutorials-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="tutorials-heading" className="text-lg font-bold text-white">
          Guided tours
        </h2>
        <button
          type="button"
          onClick={resetTutorials}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/60 transition-colors hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset all
        </button>
      </div>

      <ul className="space-y-2">
        {TOUR_ORDER.map((tourId) => {
          const tour = TOURS[tourId];
          const isCompleted = completed.includes(tourId);
          const isSkipped = skipped.includes(tourId);

          return (
            <li
              key={tourId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  {tour.name}
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Done
                    </span>
                  )}
                  {isSkipped && !isCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-white/40">
                      <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                      Skipped
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-white/50">{tour.description}</p>
              </div>

              <button
                type="button"
                onClick={() => startTour(tourId)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {isCompleted || isSkipped ? "Replay" : "Start"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
