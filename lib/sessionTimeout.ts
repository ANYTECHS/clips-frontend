"use client";

// Issue #1365 — idle session timeout.
//
// The backend session has no idle-inactivity tracking, so an abandoned
// device stays logged in until token expiry. This module tracks user
// activity client-side and forces re-authentication after the configured
// idle window. The authoritative lastActivityAt lives on UserSession in the
// API (backend issue); this client mirror ensures the UX locks promptly.
//
// Timeout is configurable via NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES
// (default 30). Set to 0 to disable.

import {
  ACTIVITY_WRITE_THROTTLE_MS,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_CHECK_INTERVAL_MS,
  MS_PER_MINUTE,
} from "./constants";

const ACTIVITY_KEY = "clp_last_activity_at";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;

function getIdleTimeoutMs(): number {
  const minutes = Number(
    process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? String(DEFAULT_IDLE_TIMEOUT_MINUTES)
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return 0; // disabled
  return minutes * MS_PER_MINUTE;
}

function markActivity(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

function getLastActivityAt(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY);
    const ts = raw ? Number(raw) : NaN;
    return Number.isFinite(ts) ? ts : Date.now();
  } catch {
    return Date.now();
  }
}

/** True when the user has been idle longer than the configured window. */
function isSessionIdle(): boolean {
  const timeout = getIdleTimeoutMs();
  if (timeout === 0) return false;
  return Date.now() - getLastActivityAt() >= timeout;
}

/**
 * Subscribes to user-activity events and invokes onIdle once when the idle
 * window elapses. Returns a cleanup function. A periodic check (not just
 * event-driven) guarantees expiry even when the tab is hidden.
 */
export function watchIdleSession(onIdle: () => void): () => void {
  const timeout = getIdleTimeoutMs();
  if (timeout === 0 || typeof window === "undefined") return () => {};

  markActivity();
  let fired = false;

  const check = () => {
    if (!fired && isSessionIdle()) {
      fired = true;
      onIdle();
    }
  };

  // Throttle activity writes — scroll/mousemove fire constantly.
  let lastWrite = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastWrite > ACTIVITY_WRITE_THROTTLE_MS) {
      lastWrite = now;
      markActivity();
    }
  };

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, onActivity, { passive: true });
  }

  const interval = window.setInterval(check, IDLE_CHECK_INTERVAL_MS);
  window.addEventListener("focus", onActivity);

  return () => {
    for (const evt of ACTIVITY_EVENTS) {
      window.removeEventListener(evt, onActivity);
    }
    window.removeEventListener("focus", onActivity);
    window.clearInterval(interval);
  };
}
