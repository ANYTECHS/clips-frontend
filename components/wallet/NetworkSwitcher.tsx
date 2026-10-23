"use client";

import { AlertTriangle } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";

import { useNetworkContext } from "@/app/context/NetworkContext";
import type { StellarNetwork } from "@/app/lib/networkConfig";

/** Text the user must type to confirm switching to mainnet. */
export const MAINNET_CONFIRMATION_TEXT = "MAINNET";

export const MAINNET_WARNING =
  "You are switching to Mainnet. Transactions will use real XLM. This cannot be undone.";

/**
 * Network switcher for the dashboard header.
 *
 * Shows the active Stellar network as a colored badge (amber = mainnet,
 * green = testnet). Switching to mainnet is treated as a destructive action:
 * a confirmation dialog warns about real funds and the user must type
 * "MAINNET" before the switch is applied. Switching back to testnet is
 * immediate.
 */
export function NetworkSwitcher({ className = "" }: { className?: string }) {
  const { network, setNetwork } = useNetworkContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const isMainnet = network === "mainnet";

  useEffect(() => {
    if (!confirmOpen) return;
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  const closeDialog = () => {
    setConfirmOpen(false);
    setConfirmText("");
  };

  const requestSwitch = (next: StellarNetwork) => {
    if (next === network) return;
    if (next === "mainnet") {
      setConfirmOpen(true);
      return;
    }
    setNetwork(next);
  };

  const confirmMainnet = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== MAINNET_CONFIRMATION_TEXT) return;
    setNetwork("mainnet");
    closeDialog();
  };

  return (
    <>
      <div
        className={`inline-flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-surface ${className}`}
        role="group"
        aria-label="Stellar network"
        data-testid="network-switcher"
      >
        <span
          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
            isMainnet
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "bg-brand/10 text-brand border border-brand/30"
          }`}
          data-testid="network-badge"
          data-network={network}
          aria-live="polite"
        >
          {isMainnet ? "Mainnet" : "Testnet"}
        </span>
        <button
          type="button"
          onClick={() => requestSwitch(isMainnet ? "testnet" : "mainnet")}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-input transition-colors cursor-pointer"
        >
          Switch to {isMainnet ? "Testnet" : "Mainnet"}
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={closeDialog}
        >
          <form
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onSubmit={confirmMainnet}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-surface p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden />
              </div>
              <h2 id={titleId} className="text-white font-bold text-base">
                Switch to Mainnet?
              </h2>
            </div>
            <p id={descId} className="text-[13px] text-zinc-300 leading-relaxed">
              {MAINNET_WARNING}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[12px] text-zinc-400">
                Type <strong className="text-white font-mono">{MAINNET_CONFIRMATION_TEXT}</strong>{" "}
                to confirm
              </span>
              <input
                ref={inputRef}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label={`Type ${MAINNET_CONFIRMATION_TEXT} to confirm`}
                className="w-full bg-input border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:text-white text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={confirmText !== MAINNET_CONFIRMATION_TEXT}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-bold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Switch to Mainnet
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
