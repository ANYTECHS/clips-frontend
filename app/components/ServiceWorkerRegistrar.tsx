"use client";

import { useEffect } from "react";

/**
 * Registers /public/sw.js in production for offline support and asset
 * caching, and asks it to replay queued API writes when the browser comes
 * back online (fallback for browsers without the Background Sync API).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });

    const onOnline = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "REPLAY_QUEUE" });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
