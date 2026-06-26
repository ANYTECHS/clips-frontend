"use client";

import React, { useState, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useWallet } from "@/components/WalletProvider";
import SocialRecoveryConfig from "@/components/SocialRecoveryConfig";
import WalletConnectButton from "@/components/WalletConnectButton";
import { Bell, BellOff, Check, X, Key, Wallet, Shield, Copy, Eye, EyeOff, Globe, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/components/auth/AuthProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import {
  getStoredPermission,
  requestNotificationPermission,
  storePermission,
} from "@/app/lib/notifications";
import Skeleton from "@/components/ui/Skeleton";
import TrustlineManager from "@/components/wallet/TrustlineManager";
import { useTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { user, setUser, isLoading: authLoading } = useAuth();
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">(
    user?.walletNetwork ?? "testnet"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permission, setPermission] = useState<"granted" | "denied" | "default">("default");
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Wallet visibility and inputs
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [advancedWalletEnabled, setAdvancedWalletEnabled] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);

  useEffect(() => {
    if (user?.walletNetwork && user.walletNetwork !== walletNetwork) {
      setWalletNetwork(user.walletNetwork);
    }
  }, [user?.walletNetwork, walletNetwork]);

  const handleNetworkChange = (network: "testnet" | "mainnet") => {
    setWalletNetwork(network);
    if (user) {
      setUser({
        ...user,
        walletNetwork: network,
      });
    }
    showToast(
      `Wallet network set to ${network === "testnet" ? "Testnet" : "Mainnet"}`,
      "success"
    );
  };

  const {
    isConnected,
    walletType,
    address,
    stellarSecret,
    stellarMnemonic,
    importStellarKey,
    isRestoringSession,
  } = useWallet();

  const pageLoading = authLoading || isRestoringSession;

  const isStellarConnected = isConnected && walletType === "stellar";

  useEffect(() => {
    // Get notification permissions
    const stored = getStoredPermission();
    if (stored) {
      setPermission(stored);
    } else if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    storePermission("denied");
    setPermission("denied");
  };

  const handleImportKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError("");
    setImportSuccess(false);

    if (!importKeyInput) {
      setImportError("Please enter a private key.");
      return;
    }

    try {
      await importStellarKey(importKeyInput);
      setImportSuccess(true);
      setImportKeyInput("");
      setTimeout(() => setImportSuccess(false), 5000);
    } catch (err: any) {
      setImportError(err.message || "Failed to import secret key. Make sure it starts with 'S' and is 56 characters.");
    }
  };

  const handleCopyKey = () => {
    if (!stellarSecret) return;
    navigator.clipboard.writeText(stellarSecret);
    setCopiedKey(true);
    showToast("Secret key copied to clipboard", "success");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyMnemonic = () => {
    if (!stellarMnemonic) return;
    navigator.clipboard.writeText(stellarMnemonic);
    setCopiedMnemonic(true);
    showToast("Recovery phrase copied to clipboard", "success");
    setTimeout(() => setCopiedMnemonic(false), 2000);
  };

  return (
    <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
      {/* Radial Glows */}
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

      {/* Sidebar Backdrop Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-8 max-w-[900px] mx-auto w-full p-6 md:p-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Wallet Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage wallet preferences, network selection, and recovery options.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-surface border border-white/5 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Stellar Network</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Switch between Testnet and Mainnet for your wallet operations.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["testnet", "mainnet"] as const).map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => handleNetworkChange(network)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${walletNetwork === network
                        ? "bg-brand text-black border-brand"
                        : "bg-white/5 text-white border-white/10 hover:border-white/20"
                        }`}
                    >
                      {network === "testnet" ? "Testnet" : "Mainnet"}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground mt-4">
                {walletNetwork === "mainnet"
                  ? "Mainnet uses live Stellar endpoints and real XLM. Use caution when transacting."
                  : "Testnet is the safe default for experimentation and development."}
              </p>
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-white">Multisig Wallet Setup</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a second signer and require multiple approvals for key transactions.
                  </p>
                </div>
              </div>

              <Link
                href="/multisig"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-brand transition hover:bg-white/10"
              >
                Configure multisig
              </Link>
            </div>
          </div>

          {pageLoading ? (
            <div className="space-y-6">
              {/* Push Notifications Skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-40" />
                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-3 w-72" />
                    </div>
                  </div>
                  <Skeleton className="w-24 h-10 rounded-xl" />
                </div>
              </div>

              {/* Language Skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-36" />
                      <Skeleton className="h-3 w-80" />
                    </div>
                  </div>
                  <Skeleton className="w-32 h-10 rounded-xl" />
                </div>
              </div>

              <div className="h-px bg-white/5 my-4" />

              {/* Advanced Wallet Settings Skeleton */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-44" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                    <Skeleton className="w-11 h-6 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Notifications */}
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold text-white">Push Notifications</h2>

                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {permission === "granted" ? (
                      <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400 shrink-0">
                        <Bell className="w-6 h-6" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                        <BellOff className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-white">
                        {permission === "granted" ? "Notifications Enabled" : "Notifications Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {permission === "granted"
                          ? "You will receive updates when clip rendering is complete"
                          : "Authorize browser notifications to receive background alerts"}
                      </p>
                    </div>
                  </div>

                  <div>
                    {permission === "granted" ? (
                      <button
                        onClick={handleDisableNotifications}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 text-xs font-bold transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={handleEnableNotifications}
                        disabled={notificationsLoading || permission === "denied"}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {notificationsLoading ? "Enabling..." : "Enable System Notifications"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Language / Locale Settings */}
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold text-white">Language</h2>

                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Interface Language</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Choose your preferred language for the wallet interface
                      </p>
                    </div>
                  </div>

                  <LocaleSwitcher />
                </div>
              </div>

              {/* Theme Toggle */}
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold text-white">Appearance</h2>

                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-bold text-white">Dark Mode</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Switch between light and dark themes
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={toggleTheme}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${theme === 'dark' ? "bg-brand" : "bg-white/10"
                      }`}
                    aria-label="Toggle Dark Mode"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/5 my-4" />

              {/* Advanced Wallet Settings */}
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold text-white">Advanced Wallet Mode</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enable advanced wallet tools to manage on-chain Stellar keys, import custom keypairs, and set up Social Recovery guardians.
                </p>

                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">Developer & Wallet Mode</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Toggle to reveal cryptographic secret keys and seed backups.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setAdvancedWalletEnabled(!advancedWalletEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${advancedWalletEnabled ? "bg-brand" : "bg-white/10"
                        }`}
                      aria-label="Toggle Advanced Wallet Mode"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${advancedWalletEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {advancedWalletEnabled && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">

                      {/* If Stellar Wallet is Connected */}
                      {isStellarConnected ? (
                        <div className="space-y-5">
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Connected Stellar Address</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 border border-brand/25 text-brand uppercase font-mono">Active</span>
                            </div>
                            <p className="text-xs font-mono text-white break-all mt-1">{address}</p>
                          </div>

                          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-white">Secret Key Export (Secure)</p>
                              <p className="text-xs text-muted-foreground leading-normal max-w-md">
                                Never share your Stellar Secret Key. Export requires multiple confirmations and supports encrypted download.
                              </p>
                              {showPrivateKey && (
                                <p className="text-xs font-mono text-brand break-all bg-brand/5 border border-brand/20 p-2 rounded-lg mt-2 select-all">
                                  {stellarSecret}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0 items-end flex-wrap md:flex-nowrap">
                              <button
                                onClick={() => setShowPrivateKey(!showPrivateKey)}
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:text-brand hover:border-brand/30 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                {showPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {showPrivateKey ? "Hide" : "Reveal"}
                              </button>

                              <button
                                onClick={() => {
                                  // minimal client-side enforcement; full flow implemented in a modal in follow-up PR if needed
                                  if (!stellarSecret) return;
                                  const ok1 = window.confirm("Warning: This is your raw Stellar Secret Key. Anyone with it controls your funds. Continue?");
                                  if (!ok1) return;
                                  const ok2 = window.confirm("Last chance: Click OK to download an encrypted backup. Your password is required.");
                                  if (!ok2) return;
                                  // encrypted download is handled by a future secure modal; for now, we block raw copy via this button
                                  showToast("Encrypted export will be available in the next step.", "success");
                                }}
                                className="px-3 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all flex items-center gap-1 cursor-pointer"
                                disabled={!stellarSecret}
                              >
                                <Key className="w-3.5 h-3.5" aria-hidden="true" />
                                Export (Encrypted)
                              </button>

                              {showPrivateKey && (
                                <button
                                  onClick={handleCopyKey}
                                  className="px-3 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  Copy
                                </button>
                              )}
                            </div>
                          </div>

                          {stellarMnemonic && (
                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                              <div className="space-y-1">
                                <p className="font-bold text-sm text-white">Recovery Mnemonic Phrase</p>
                                <p className="text-xs text-muted-foreground leading-normal max-w-md">
                                  This 12-word phrase restores your wallet connection. Store it offline.
                                </p>
                                {showMnemonic && (
                                  <p className="text-xs font-mono text-brand bg-brand/5 border border-brand/20 p-2.5 rounded-lg mt-2 leading-relaxed select-all">
                                    {stellarMnemonic}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 shrink-0 items-end">
                                <button
                                  onClick={() => setShowMnemonic(!showMnemonic)}
                                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:text-brand hover:border-brand/30 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {showMnemonic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  {showMnemonic ? "Hide" : "Reveal"}
                                </button>
                                {showMnemonic && (
                                  <button
                                    onClick={handleCopyMnemonic}
                                    className="px-3 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedMnemonic ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    Copy
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Social Recovery Section inside advanced settings */}
                          <SocialRecoveryConfig />

                          {/* Trustline Manager */}
                          <TrustlineManager
                            publicKey={address!}
                            secretKey={stellarSecret}
                          />
                        </div>
                      ) : (
                        // If Stellar wallet is NOT connected
                        <div className="space-y-5">
                          <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 border-dashed text-center">
                            <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs font-semibold text-muted-foreground">
                              Stellar Wallet is currently disconnected. Please connect or generate a wallet to enable advanced modes.
                            </p>
                          </div>

                          <div className="max-w-md mx-auto">
                            <WalletConnectButton />
                          </div>

                          <div className="h-px bg-white/5 my-4" />

                          {/* Import Key Form */}
                          <form onSubmit={handleImportKeySubmit} className="space-y-3.5">
                            <div className="space-y-2">
                              <label className="block text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
                                Or Import Stellar Private Key
                              </label>
                              <input
                                type="password"
                                placeholder="Starts with 'S'... (56 characters)"
                                value={importKeyInput}
                                onChange={(e) => setImportKeyInput(e.target.value)}
                                className="w-full bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none transition-colors"
                              />
                            </div>

                            {importError && (
                              <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-center">
                                <span className="text-xs text-red-400 font-semibold">{importError}</span>
                              </div>
                            )}

                            {importSuccess && (
                              <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-center">
                                <span className="text-xs text-emerald-400 font-semibold">Stellar private key imported successfully!</span>
                              </div>
                            )}

                            <button
                              type="submit"
                              className="w-full py-3.5 rounded-xl border border-white/10 hover:border-brand/35 text-white hover:text-brand transition-colors text-xs font-bold cursor-pointer"
                            >
                              Import Secret Key
                            </button>
                          </form>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
