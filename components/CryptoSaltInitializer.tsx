"use client";

import { useEffect } from "react";
import { migrateCryptoSalt } from "@/app/lib/secureStorage";

/**
 * Initializes and migrates cryptographic salt material upon app startup.
 *
 * Deferred to an idle callback (#921): the migration only needs to have run
 * before the first wallet operation, not before first paint, so it's
 * scheduled after the browser is done with more time-critical work rather
 * than competing with initial render on the main thread.
 */
export default function CryptoSaltInitializer() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => migrateCryptoSalt(), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }

    const timeoutId = setTimeout(() => migrateCryptoSalt(), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}
