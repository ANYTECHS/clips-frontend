"use client";

import React from "react";
import CryptoSaltInitializer from "./CryptoSaltInitializer";
import { EmbeddedWalletProvider } from "./EmbeddedWalletProvider";

/**
 * StellarWalletProvider
 * 
 * Main wallet context provider wrapping the application.
 * Ensures CryptoSaltInitializer is called to ready the AES key before any wallet operations,
 * and wraps children in EmbeddedWalletProvider to auto-create and expose embedded Stellar wallets.
 */
export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CryptoSaltInitializer />
      <EmbeddedWalletProvider>{children}</EmbeddedWalletProvider>
    </>
  );
}
