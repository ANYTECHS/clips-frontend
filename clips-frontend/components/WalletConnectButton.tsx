"use client";

import React, { useState, useRef, useEffect } from "react";
import { Loader2, Wallet, LogOut, AlertCircle, X, ChevronDown, Coins, ExternalLink } from "lucide-react";
import { useWallet, truncateAddress } from "./WalletProvider";
import analytics from "@/lib/analytics";

interface WalletConnectButtonProps {
  /** Compact mode renders a smaller pill button (e.g. for headers/navbars) */
  compact?: boolean;
}

/** Detects whether MetaMask is installed in the browser */
function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.ethereum?.isMetaMask);
}

export default function WalletConnectButton({ compact = false }: WalletConnectButtonProps) {
  const {
    isConnected,
    isConnecting,
    address,
    walletType,
    error,
    balance,
    connectMetaMask,
    connectPhantom,
    connectStellar,
    disconnect,
    clearError,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus error message when error appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      buttonRef.current?.focus();
    }
  };

  const getWalletIcon = (type: string | null) => {
    switch (type) {
      case "metamask":
        return "🦊";
      case "phantom":
        return "👻";
      case "stellar":
        return "⚡";
      default:
        return "💼";
    }
  };

  const getWalletName = (type: string | null) => {
    switch (type) {
      case "metamask":
        return "MetaMask";
      case "phantom":
        return "Phantom";
      case "stellar":
        return "Stellar";
      default:
        return "Wallet";
    }
  };

  const handleConnect = async () => {
    await connectMetaMask();
    // Track wallet connection (will be called after successful connection)
    if (address) {
      analytics.trackWalletConnect('metamask');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    analytics.trackEvent('wallet_disconnect', { wallet_type: 'metamask' });
  };

  // Flash a "just connected" success state for 2 seconds after connecting
  const [justConnected, setJustConnected] = useState(false);
  const prevConnected = useRef(false);

  // Copy-to-clipboard state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!prevConnected.current && isConnected) {
      setJustConnected(true);
      const t = setTimeout(() => setJustConnected(false), 2000);
      return () => clearTimeout(t);
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const metaMaskInstalled = isMetaMaskInstalled();

  // ─── Compact variant (header / navbar) ───────────────────────────────────
  if (compact) {
    if (isRestoringSession) {
      return (
        <div className="w-[130px] h-9 rounded-xl bg-white/6 animate-pulse" />
      );
    }

    return (
      <div className="relative flex flex-col items-end gap-2">
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 bg-brand/10 border border-brand/20 rounded-xl px-3.5 py-2">
              <span className="text-[13px]">{getWalletIcon(walletType)}</span>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[12px] font-mono font-bold text-brand">
                  {truncateAddress(address)}
                </span>
                {walletType === "stellar" && balance !== null && (
                  <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    {parseFloat(balance).toFixed(2)} XLM
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              title="Disconnect wallet"
              aria-label="Disconnect wallet"
              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-muted-foreground hover:text-red-400 hover:border-red-400/20 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            aria-label="Connect MetaMask wallet"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand/10 border border-brand/20 text-brand font-bold text-[13px] hover:bg-brand/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting…</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span className="hidden xs:inline">Connect Wallet</span>
              </>
            )}
          </div>
        )}

        {/* Inline error toast */}
        {error && (
          <div 
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            className="absolute top-full mt-2 right-0 z-50 flex items-start gap-2 bg-red-950/85 border border-red-500/30 rounded-xl px-4 py-3 max-w-[280px] shadow-xl backdrop-blur-md"
            tabIndex={-1}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-red-300 leading-snug flex-1">{error}</p>
            <button 
              onClick={clearError} 
              className="text-red-400 hover:text-red-200 transition-colors shrink-0 cursor-pointer" 
              aria-label="Close error message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Full-size variant (platform cards / standalone pages) ────────────────
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Error banner */}
      {error && (
        <div 
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 bg-red-950/60 border border-red-500/25 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-red-300 leading-snug flex-1">{error}</p>
          <button 
            onClick={clearError} 
            className="text-red-400 hover:text-red-200 transition-colors shrink-0 cursor-pointer" 
            aria-label="Close error message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isConnected && address ? (
        <button
          onClick={handleDisconnect}
          aria-label="Disconnect wallet"
          className="w-full py-4 rounded-xl font-bold text-[14px] bg-transparent border border-white/10 text-white hover:bg-red-950/30 hover:border-red-500/30 hover:text-red-400 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          aria-label="Connect MetaMask wallet"
          className="w-full py-4 rounded-xl font-bold text-[14px] bg-brand hover:bg-brand-hover text-black shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_35px_rgba(0,229,143,0.35)] transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Waiting for MetaMask…</span>
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              <span>Connect MetaMask</span>
            </>
          )}
        </button>
      ) : (
        /* MetaMask not installed — prompt to install */
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 rounded-xl font-bold text-[14px] bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
          aria-label="Install MetaMask browser extension (opens in new tab)"
        >
          <ExternalLink className="w-5 h-5" aria-hidden="true" />
          Install MetaMask to Connect
        </a>
      )}

      {/* Connecting progress indicator */}
      {isConnecting && (
        <p 
          role="status"
          aria-live="polite"
          className="text-center text-[12px] text-[#5A6F65] animate-in fade-in duration-300"
        >
          Check the MetaMask popup to approve the connection.
        </p>
      )}
    </div>
  );
}
