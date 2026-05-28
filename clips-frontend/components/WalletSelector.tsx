"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Wallet, 
  ChevronDown, 
  Check, 
  Plus, 
  Trash2, 
  Star,
  ExternalLink,
  Copy,
  CheckCheck
} from "lucide-react";
import { MultiWalletStorage, MultiWalletRecord, WalletProviderType } from "@/app/lib/multiWalletStorage";
import { truncateAddress } from "./WalletProvider";
import { truncateStellarAddress } from "@/app/lib/embeddedWallet";
import { useToast } from "@/hooks/useToast";

interface WalletSelectorProps {
  userId: string | null;
  onWalletSelect?: (wallet: MultiWalletRecord) => void;
  onAddWallet?: () => void;
  compact?: boolean;
}

export default function WalletSelector({ 
  userId, 
  onWalletSelect, 
  onAddWallet,
  compact = false 
}: WalletSelectorProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [wallets, setWallets] = useState<MultiWalletRecord[]>([]);
  const [activeWallet, setActiveWallet] = useState<MultiWalletRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load wallets when userId changes
  useEffect(() => {
    if (!userId) return;
    const data = MultiWalletStorage.getWalletData(userId);
    setWallets(data.wallets);
    setActiveWallet(data.activeWallet);
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleSelectWallet = (wallet: MultiWalletRecord) => {
    if (!userId) return;
    MultiWalletStorage.setActiveWallet(userId, wallet.id);
    setActiveWallet(wallet);
    setIsOpen(false);
    onWalletSelect?.(wallet);
  };

  const handleRemoveWallet = (e: React.MouseEvent, walletId: string) => {
    e.stopPropagation();
    if (!userId) return;
    
    const wallet = wallets.find(w => w.id === walletId);
    if (wallet?.isPrimary) {
      // Don't allow removing primary wallet
      return;
    }

    if (confirm("Are you sure you want to remove this wallet?")) {
      MultiWalletStorage.removeWallet(userId, walletId);
      const data = MultiWalletStorage.getWalletData(userId);
      setWallets(data.wallets);
      setActiveWallet(data.activeWallet);
    }
  };

  const handleSetPrimary = (e: React.MouseEvent, walletId: string) => {
    e.stopPropagation();
    if (!userId) return;
    MultiWalletStorage.updateWallet(userId, walletId, { isPrimary: true });
    const data = MultiWalletStorage.getWalletData(userId);
    setWallets(data.wallets);
  };

  const handleCopyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      showToast("Wallet address copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getWalletIcon = (type: WalletProviderType): string => {
    switch (type) {
      case "metamask":
        return "🦊";
      case "phantom":
        return "👻";
      case "freighter":
        return "🚀";
      case "stellar":
        return "⚡";
      case "embedded":
        return "💼";
      case "imported":
        return "🔑";
      default:
        return "📱";
    }
  };

  const getWalletLabel = (wallet: MultiWalletRecord): string => {
    return wallet.label || getDefaultWalletLabel(wallet.walletType);
  };

  const getDefaultWalletLabel = (type: WalletProviderType): string => {
    switch (type) {
      case "embedded":
        return "Primary Wallet";
      case "metamask":
        return "MetaMask";
      case "phantom":
        return "Phantom";
      case "freighter":
        return "Freighter";
      case "stellar":
        return "Stellar Wallet";
      case "imported":
        return "Imported Wallet";
      default:
        return "Wallet";
    }
  };

  const truncateWalletAddress = (address: string, type: WalletProviderType): string => {
    if (type === "embedded" || type === "stellar" || type === "freighter") {
      return truncateStellarAddress(address);
    }
    return truncateAddress(address);
  };

  if (!userId || wallets.length === 0) {
    return null;
  }

  // Compact variant (for header/navbar)
  if (compact) {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={`Current wallet: ${getWalletLabel(activeWallet || wallets[0])}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 transition-all"
        >
          <span className="text-base">{getWalletIcon(activeWallet?.walletType || wallets[0].walletType)}</span>
          <span className="text-[13px] font-medium">
            {truncateWalletAddress(activeWallet?.publicKey || wallets[0].publicKey, activeWallet?.walletType || wallets[0].walletType)}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOpen && (
          <div 
            ref={dropdownRef}
            role="menu"
            onKeyDown={handleKeyDown}
            className="absolute right-0 mt-2 w-80 bg-surface/95 backdrop-blur-md border border-white/10 rounded-[16px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50"
          >
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Select Wallet
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleSelectWallet(wallet)}
                  role="menuitem"
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors ${
                    activeWallet?.id === wallet.id ? "bg-brand/10" : ""
                  }`}
                >
                  <span className="text-xl">{getWalletIcon(wallet.walletType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-white">
                        {getWalletLabel(wallet)}
                      </span>
                      {wallet.isPrimary && (
                        <Star className="w-3 h-3 text-brand fill-brand" aria-hidden="true" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {truncateWalletAddress(wallet.publicKey, wallet.walletType)}
                    </span>
                  </div>
                  {activeWallet?.id === wallet.id && (
                    <Check className="w-4 h-4 text-brand" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-white/5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddWallet?.();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand text-[13px] font-medium transition-colors w-full"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant (for wallet cards/settings)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-white">Connected Wallets</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Manage wallets"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-[13px] text-muted-foreground hover:text-white hover:bg-white/[0.1] transition-all"
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span>{wallets.length} Wallet{wallets.length !== 1 ? "s" : ""}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          role="region"
          aria-label="Wallet list"
          className="space-y-2"
        >
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className={`p-4 rounded-xl border transition-all ${
                activeWallet?.id === wallet.id
                  ? "bg-brand/10 border-brand/30"
                  : "bg-surface-hover border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                    <span className="text-xl">{getWalletIcon(wallet.walletType)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-white">
                        {getWalletLabel(wallet)}
                      </span>
                      {wallet.isPrimary && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/20 border border-brand/30 text-brand text-[10px] font-bold">
                          <Star className="w-3 h-3 fill-brand" aria-hidden="true" />
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground font-mono">
                        {truncateWalletAddress(wallet.publicKey, wallet.walletType)}
                      </span>
                      <button
                        onClick={(e) => handleCopyAddress(e, wallet.publicKey)}
                        className="text-muted-foreground hover:text-brand transition-colors"
                        aria-label={copied ? "Address copied" : "Copy address"}
                      >
                        {copied ? (
                          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeWallet?.id !== wallet.id && (
                    <button
                      onClick={() => handleSelectWallet(wallet)}
                      className="p-2 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand transition-colors"
                      aria-label={`Switch to ${getWalletLabel(wallet)}`}
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {!wallet.isPrimary && (
                    <button
                      onClick={(e) => handleSetPrimary(e, wallet.id)}
                      className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-muted-foreground hover:text-white transition-colors"
                      aria-label={`Set ${getWalletLabel(wallet)} as primary`}
                    >
                      <Star className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {!wallet.isPrimary && (
                    <button
                      onClick={(e) => handleRemoveWallet(e, wallet.id)}
                      className="p-2 rounded-lg bg-error/10 hover:bg-error/20 text-error transition-colors"
                      aria-label={`Remove ${getWalletLabel(wallet)}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              setIsOpen(false);
              onAddWallet?.();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-brand hover:text-brand transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="text-[13px] font-medium">Add Another Wallet</span>
          </button>
        </div>
      )}
    </div>
  );
}
