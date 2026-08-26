"use client";

import { useEffect } from "react";
import { migrateCryptoSalt } from "@/app/lib/secureStorage";

/**
 * Initializes and migrates cryptographic salt material upon app startup.
 * Ensured to run before any wallet operations execute.
 */
export default function CryptoSaltInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      migrateCryptoSalt();
    }
  }, []);

  return null;
}
