"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellOff, Check, X, Key, Wallet, Shield, Download } from "lucide-react";
import {
  getStoredPermission,
  requestNotificationPermission,
  storePermission,
  canSendNotification,
} from "@/app/lib/notifications";

export default function SettingsPage() {
  const [permission, setPermission] = useState<"granted" | "denied" | "default">("default");
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [advancedWalletEnabled, setAdvancedWalletEnabled] = useState(false);

  const mockPrivateKey = "0x8f2a7b9c3d4e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4";

  useEffect(() => {
    // Get current permission state
    const stored = getStoredPermission();
    if (stored) {
      setPermission(stored);
    } else if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      
      if (result === "granted") {
        // Send a test notification
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification("Notifications Enabled!", {
            body: "You'll be notified when your clips are ready.",
            icon: "/avatar.png",
          });
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    storePermission("denied");
    setPermission("denied");
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col font-sans relative overflow-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand/5 blur-[120px] rounded-full" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-2xl bg-surface border border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight mb-8">Settings</h1>

          {/* Notification Settings */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Notifications</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Manage your push notification preferences. You'll be notified when your video processing is complete.
              </p>
            </div>

            <div className="bg-input/50 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {permission === "granted" ? (
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Bell className="w-6 h-6 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <BellOff className="w-6 h-6 text-red-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-white">
                      {permission === "granted" ? "Notifications Enabled" : "Notifications Disabled"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {permission === "granted"
                        ? "You'll receive notifications when your clips are ready"
                        : "Enable to get notified when processing completes"}
                    </p>
                  </div>
                </div>

                <div>
                  {permission === "granted" ? (
                    <button
                      onClick={handleDisableNotifications}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/20 transition-all"
                    >
                      <X className="w-4 h-4" />
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={handleEnableNotifications}
                      disabled={isLoading || permission === "denied"}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black text-sm font-bold hover:bg-brand-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      {isLoading ? "Enabling..." : "Enable"}
                    </button>
                  )}
                </div>
              </div>

              {permission === "denied" && (
                <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-500">
                    Notifications are blocked. To enable them, you'll need to reset permissions in your browser settings.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-input/50 rounded-2xl p-6 border border-white/5">
              <h3 className="font-bold text-white mb-2">About Notifications</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <span>You'll be notified when your video processing completes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <span>Clicking a notification takes you to your projects</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <span>Notifications work even when the tab is closed (via service worker)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                  <span>Your preference is saved locally in your browser</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Advanced Wallet Settings */}
          <div className="space-y-6 mt-12">
            <div>
              <h2 className="text-xl font-bold mb-4">Advanced Wallet Mode</h2>
              <p className="text-muted-foreground text-sm mb-6">
                For power users: Export your secret key or connect an external wallet as a backup for your ClipCash account.
              </p>
            </div>

            <div className="bg-input/50 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Advanced Features</p>
                    <p className="text-sm text-muted-foreground">
                      {advancedWalletEnabled
                        ? "Advanced wallet features are enabled"
                        : "Enable to access private keys and external backups"}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setAdvancedWalletEnabled(!advancedWalletEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    advancedWalletEnabled ? "bg-brand" : "bg-white/10"
                  }`}
                  aria-label="Toggle Advanced Wallet Mode"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      advancedWalletEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {advancedWalletEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-bold text-sm text-white">Export Secret Key</p>
                        <p className="text-xs text-muted-foreground">
                          {showPrivateKey ? mockPrivateKey : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold hover:bg-white/5 transition-colors"
                      >
                        {showPrivateKey ? "Hide" : "Reveal"}
                      </button>
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors">
                        <Download className="w-3 h-3" />
                        Export
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-bold text-sm text-white">External Backup Wallet</p>
                        <p className="text-xs text-muted-foreground">Connect a Web3 wallet as recovery backup</p>
                      </div>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg border border-white/10 text-xs font-bold hover:bg-white/5 transition-colors">
                      Connect Backup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
