"use client";

// Issue #1366 — step-up authentication for sensitive wallet operations.
// Sensitive actions (send/mint) require a fresh verification no older than
// STEP_UP_WINDOW_MS. The verified timestamp is kept in sessionStorage so it
// survives reloads within the tab but not across sessions.

import { STEP_UP_WINDOW_MS } from "./constants";

const STORAGE_KEY = "clp_stepup_verified_at";

function getStepUpVerifiedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

/** True when a step-up verification happened within the last 5 minutes. */
export function isStepUpFresh(): boolean {
  const ts = getStepUpVerifiedAt();
  return ts !== null && Date.now() - ts < STEP_UP_WINDOW_MS;
}

export function markStepUpVerified(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}
