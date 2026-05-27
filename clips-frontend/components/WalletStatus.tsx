"use client";

import React, { useState } from "react";
import { useWallet, truncateAddress } from "./WalletProvider";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";

/**
 * WalletStatus - Displays wallet connection status in the navbar
 * 
 * Shows:
 * - Connection status (Connected/Disconnected)
 * - Wallet type (MetaMask/Phantom)
 * - Truncated wallet address
 * - Dropdown menu with disconnect option
 * - Copy address functionality
 */

export default function WalletStatus() {
  const { address, isConnected, walletType, disconnect } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  /**
   * Copy wallet address to clipboard
   */
  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[13px] text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-red-500/60" />
        <span>Disconnected</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand/10 border border-brand/30 text-[13px] font-medium text-brand hover:bg-brand/20 transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        <span className="hidden sm:inline">
          {walletType === "metamask" ? "MetaMask" : "Phantom"}
        </span>
        <span className="sm:hidden">
          {truncateAddress(address)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{
          transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)"
        }} />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface/95 backdrop-blur-md border border-white/10 rounded-[16px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
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
              >
                {copied ? (
                  <Check className="w-4 h-4 text-brand" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Status Info */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                <span className="text-[12px] font-semibold text-brand">Connected</span>
              </div>
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
