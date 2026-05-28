"use client";

import React, { useState } from "react";
import { useWallet, truncateAddress } from "./WalletProvider";
import { useAuth } from "./AuthProvider";
import { Wallet, ChevronDown, LogOut, Copy, Check, Layers } from "lucide-react";
import WalletSelector from "./WalletSelector";
import { useToast } from "@/hooks/useToast";

/**
 * WalletStatus - Displays wallet connection status in the navbar
 * 
 * Shows:
 * - Connection status (Connected/Disconnected)
 * - Wallet type (MetaMask/Phantom)
 * - Truncated wallet address
 * - Dropdown menu with disconnect option
 * - Copy address functionality
 * - Multi-wallet selector (when multiple wallets are available)
 */

export default function WalletStatus() {
  const { address, isConnected, walletType, disconnect } = useWallet();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownId = React.useId();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      buttonRef.current?.focus();
    }
  };

  // Announce copy action to screen readers
  React.useEffect(() => {
    if (copied) {
      // Copy action is announced via button label change
    }
  }, [copied]);

  /**
   * Copy wallet address to clipboard
   */
  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      showToast("Wallet address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Handle disconnect
   */
  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
  };

  if (!isConnected || !address) {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[13px] text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <div className="w-2 h-2 rounded-full bg-red-500/60" aria-hidden="true" />
        <span>Disconnected</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Button */}
      <button
        ref={buttonRef}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-controls={dropdownId}
        aria-label={`${walletType === "metamask" ? "MetaMask" : "Phantom"} wallet connected. Click to view wallet options.`}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand/10 border border-brand/30 text-[13px] font-medium text-brand hover:bg-brand/20 transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" aria-hidden="true" />
        <span className="hidden sm:inline">
          {walletType === "metamask" ? "MetaMask" : "Phantom"}
        </span>
        <span className="sm:hidden">
          {truncateAddress(address)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 transition-transform" aria-hidden="true" style={{
          transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)"
        }} />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div 
          id={dropdownId}
          ref={dropdownRef}
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute right-0 mt-2 w-56 bg-surface/95 backdrop-blur-md border border-white/10 rounded-[16px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Connected Wallet
            </p>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand" />
              <span className="text-[13px] font-semibold text-white">
                {walletType === "metamask" ? "MetaMask" : "Phantom"}
              </span>
            </div>
          </div>

          {/* Address Section */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Address
            </p>
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-[8px] px-3 py-2">
              <span className="text-[12px] font-mono text-white/80 flex-1 truncate">
                {truncateAddress(address)}
              </span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 text-muted-foreground hover:text-white transition-colors"
                title="Copy full address"
                aria-label={copied ? "Address copied to clipboard" : "Copy full address to clipboard"}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-brand" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Status Info */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" aria-hidden="true" />
                <span className="text-[12px] font-semibold text-brand">Connected</span>
              </div>
            </div>
          </div>

          {/* Multi-Wallet Selector (when authenticated) */}
          {user && (
            <div className="px-4 py-3 border-b border-white/5">
              <WalletSelector 
                userId={user.id} 
                compact={true}
                onWalletSelect={() => setDropdownOpen(false)}
              />
            </div>
          )}

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            role="menuitem"
            className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Disconnect wallet"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
