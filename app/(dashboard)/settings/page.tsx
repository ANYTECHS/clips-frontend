"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Lock,
  Monitor,
  Moon,
  Shield,
  Sparkles,
  Sun,
  TimerOff,
  Trash2,
  Upload,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { usePasskeyWallet } from "@/app/hooks/usePasskeyWallet";
import { analytics } from "@/app/lib/analytics";
import { encryptWithPassword } from "@/app/lib/cryptoUtils";
import { logger } from "@/app/lib/logger";
import {
  getNotificationSettingsInstructions,
  getNotificationSettingsUrl,
  getStoredPermission,
  requestNotificationPermission,
  storePermission,
  syncNotificationPermission,
  watchNotificationPermission,
} from "@/app/lib/browserNotifications";
import { useAuth } from "@/components/auth/AuthProvider";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import MonthlyReportSetting from "@/components/settings/MonthlyReportSetting";
import { NotificationChannelSettings } from "@/components/settings/NotificationChannelSettings";
import PrivacySettings from "@/components/settings/PrivacySettings";
import { Theme, useTheme } from "@/components/theme-provider";
import Skeleton from "@/components/ui/Skeleton";
import TrustlineManager from "@/components/wallet/TrustlineManager";
import WalletConnectButton from "@/components/WalletConnectButton";
import { useWallet } from "@/components/WalletProvider";
import { useToast } from "@/hooks/useToast";

const SocialRecoveryConfig = dynamic(
  () => import("@/components/SocialRecoveryConfig"),
  {
    ssr: false,
    loading: () => (
      <div className="bg-surface border border-border rounded-[24px] p-6 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
    ),
  }
);

export type SettingsTab =
  | "profile"
  | "notifications"
  | "display"
  | "wallet"
  | "privacy";

interface TabDefinition {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDefinition[] = [
  {
    id: "profile",
    label: "Profile",
    icon: UserIcon,
    description: "Personal details and avatar",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Channels and event alerts",
  },
  {
    id: "display",
    label: "Display",
    icon: Monitor,
    description: "Theme, language, and timezone",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    description: "Stellar network and security",
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: Shield,
    description: "Data export and account",
  },
];

export interface SettingsPageProps {
  initialTab?: SettingsTab;
}

export function SettingsPage({ initialTab = "profile" }: SettingsPageProps) {
  const { showToast } = useToast();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user, setUser, isLoading: authLoading } = useAuth();
  const {
    isConnected,
    walletType,
    address,
    stellarSecret,
    stellarMnemonic,
    importStellarKey,
    isRestoringSession,
  } = useWallet();

  const {
    credentialId: passkeyCredentialId,
    publicKey: passkeyPublicKey,
    isSupported: passkeySupported,
    isRegistering: passkeyRegistering,
    error: passkeyError,
    compatibility: passkeyCompatibility,
    register: registerPasskey,
    reset: resetPasskey,
  } = usePasskeyWallet();

  // Tab navigation
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const tabListRef = useRef<HTMLDivElement>(null);

  // User preferences state & dirty tracking
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultUserPreferences);
  const [savedPreferences, setSavedPreferences] =
    useState<UserPreferences>(defaultUserPreferences);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatarUrl || null
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification permissions & toggles
  const [permission, setPermission] = useState<"granted" | "denied" | "default">(
    "default"
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Wallet network & settings
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">(
    user?.walletNetwork ?? "testnet"
  );
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [mnemonicRevealed, setMnemonicRevealed] = useState(false);
  const [advancedWalletEnabled, setAdvancedWalletEnabled] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [mnemonicCopied, setMnemonicCopied] = useState(false);
  const [mnemonicClipboardCountdown, setMnemonicClipboardCountdown] =
    useState(0);

  // Encrypted export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  // Privacy: data export & account deletion
  const [exportingData, setExportingData] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Timers
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mnemonicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch initial preferences from API
  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        const res = await fetch("/api/user/preferences");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && typeof data === "object") {
            const merged: UserPreferences = {
              profile: {
                ...defaultUserPreferences.profile,
                ...(data.profile || {}),
              },
              notifications: {
                email: {
                  ...defaultUserPreferences.notifications.email,
                  ...(data.notifications?.email || {}),
                },
                push: {
                  ...defaultUserPreferences.notifications.push,
                  ...(data.notifications?.push || {}),
                },
                inApp: {
                  ...defaultUserPreferences.notifications.inApp,
                  ...(data.notifications?.inApp || {}),
                },
              },
              display: {
                ...defaultUserPreferences.display,
                ...(data.display || {}),
              },
              wallet: {
                ...defaultUserPreferences.wallet,
                ...(data.wallet || {}),
              },
              privacy: {
                ...defaultUserPreferences.privacy,
                ...(data.privacy || {}),
              },
              ranking: {
                ...defaultUserPreferences.ranking,
                ...(data.ranking || {}),
                weights: {
                  ...defaultUserPreferences.ranking.weights,
                  ...(data.ranking?.weights || {}),
                },
              },
            };
            setPreferences(merged);
            setSavedPreferences(merged);
            if (data.display?.theme) {
              setTheme(data.display.theme as Theme);
            }
            if (data.wallet?.defaultNetwork) {
              setWalletNetwork(data.wallet.defaultNetwork);
            }
          }
        }
      } catch (err) {
        logger.error("Failed to load user preferences:", err);
      } finally {
        if (isMounted) setPrefsLoading(false);
      }
    }
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [setTheme]);

  // Sync user state to profile fields
  useEffect(() => {
    if (user?.name && !displayName) {
      setDisplayName(user.name);
    }
    if (user?.avatarUrl && !avatarPreview) {
      setAvatarPreview(user.avatarUrl);
    }
    if (user?.walletNetwork && user.walletNetwork !== walletNetwork) {
      setWalletNetwork(user.walletNetwork);
    }
  }, [user, displayName, avatarPreview, walletNetwork]);

  // Push notifications permission sync
  useEffect(() => {
    const stored =
      typeof getStoredPermission === "function" ? getStoredPermission() : null;
    const synced =
      typeof syncNotificationPermission === "function"
        ? syncNotificationPermission()
        : "default";
    setPermission(stored ?? synced);
    if (typeof watchNotificationPermission === "function") {
      return watchNotificationPermission(setPermission);
    }
  }, []);

  // Dirty state tracking
  const isDirty =
    JSON.stringify(preferences) !== JSON.stringify(savedPreferences) ||
    displayName !== (user?.name || "");

  // Warn on unsaved changes before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ── Keyboard accessibility for tablist ────────────────────────────────────
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const targetTab = TABS[nextIndex].id;
      setActiveTab(targetTab);
      const buttons =
        tabListRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="tab"]'
        );
      buttons?.[nextIndex]?.focus();
    }
  };

  // ── Preference persistence with optimistic update & rollback ──────────────
  const persistPreferences = async (
    updates: Partial<UserPreferences>,
    successMessage = "Preferences saved"
  ) => {
    const previous = preferences;
    const next: UserPreferences = {
      ...preferences,
      ...updates,
      notifications: {
        ...preferences.notifications,
        ...(updates.notifications || {}),
      },
      display: {
        ...preferences.display,
        ...(updates.display || {}),
      },
      wallet: {
        ...preferences.wallet,
        ...(updates.wallet || {}),
      },
      privacy: {
        ...preferences.privacy,
        ...(updates.privacy || {}),
      },
    };

    // Optimistic update
    setPreferences(next);
    setIsSaving(true);

    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error("Failed to save preferences");
      }

      const saved = await res.json();
      setSavedPreferences(saved);
      setPreferences(saved);
      showToast(successMessage, "success");
      return true;
    } catch (err) {
      // Rollback
      setPreferences(previous);
      logger.error("Error saving preferences:", err);
      showToast("Failed to save changes. Reverted.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ── Avatar Upload with Client-Side 1MB & Magic Bytes Check ────────────────
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    // 1. Check size limit
    if (file.size > MAX_AVATAR_BYTES) {
      const errorMsg = "Avatar file exceeds maximum size limit of 1 MB";
      setAvatarError(errorMsg);
      showToast(errorMsg, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. Validate magic bytes client-side
    try {
      const arrayBuffer =
        typeof file.arrayBuffer === "function"
          ? await file.arrayBuffer()
          : await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = () => reject(reader.error);
              reader.readAsArrayBuffer(file);
            });
      const validation = validateAvatarFile(arrayBuffer, file.size);
      if (!validation.valid) {
        const errorMsg =
          validation.error ||
          "Invalid image format. Supported: PNG, JPEG, GIF, WebP";
        setAvatarError(errorMsg);
        showToast(errorMsg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Preview immediately
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);

      // Upload to API
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to upload avatar");
      }

      const json = await res.json();
      if (json.avatarUrl) {
        setAvatarPreview(json.avatarUrl);
        if (user) {
          setUser({ ...user, avatarUrl: json.avatarUrl });
        }
      }
      showToast("Avatar updated successfully", "success");
    } catch (err: any) {
      logger.error("Avatar upload failed:", err);
      setAvatarError(err.message || "Failed to upload avatar");
      showToast(err.message || "Failed to upload avatar", "error");
      setAvatarPreview(user?.avatarUrl || null);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Profile Save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Display name cannot be empty", "error");
      return;
    }

    const sanitizedName = sanitize(displayName.trim());
    setIsSaving(true);
    try {
      if (user) {
        setUser({ ...user, name: sanitizedName });
      }
      await persistPreferences({}, "Profile saved successfully");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Notification Channel / Event Toggle ───────────────────────────────────
  const handleToggleNotification = (
    channel: "email" | "push" | "inApp",
    event:
      | "job_complete"
      | "transform_complete"
      | "mint_success"
      | "earnings_received"
  ) => {
    const currentChannelSettings = preferences.notifications[channel];
    const updatedChannel = {
      ...currentChannelSettings,
      [event]: !currentChannelSettings[event],
    };

    persistPreferences({
      notifications: {
        ...preferences.notifications,
        [channel]: updatedChannel,
      },
    });
  };

  // ── Push Permission Handlers ──────────────────────────────────────────────
  const handleEnableNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === "denied") {
        showToast(getNotificationSettingsInstructions(), "error");
      } else if (result === "granted") {
        showToast("System notifications enabled", "success");
      }
    } catch (error) {
      logger.error("Error requesting notification permission:", error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    storePermission("denied");
    setPermission("denied");
    showToast("Notifications disabled", "info");
  };

  // ── Display Theme / Language / Timezone Handlers ──────────────────────────
  const handleThemeSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme);
    persistPreferences({
      display: {
        ...preferences.display,
        theme: selectedTheme,
      },
    });
  };

  const handleLanguageSelect = (lang: string) => {
    persistPreferences({
      display: {
        ...preferences.display,
        language: lang,
      },
    });
  };

  const handleTimezoneSelect = (tz: string) => {
    if (!validateTimezone(tz)) {
      showToast("Invalid IANA timezone identifier", "error");
      return;
    }
    persistPreferences({
      display: {
        ...preferences.display,
        timezone: tz,
      },
    });
  };

  // ── Wallet Handlers ───────────────────────────────────────────────────────
  const handleNetworkChange = (network: "testnet" | "mainnet") => {
    setWalletNetwork(network);
    if (user) {
      setUser({ ...user, walletNetwork: network });
    }
    persistPreferences({
      wallet: {
        ...preferences.wallet,
        defaultNetwork: network,
      },
    });
    showToast(
      `Wallet network set to ${network === "testnet" ? "Testnet" : "Mainnet"}`,
      "success"
    );
  };

  const handleGasChange = (preset: "slow" | "medium" | "fast") => {
    persistPreferences({
      wallet: {
        ...preferences.wallet,
        gasPreference: preset,
      },
    });
  };

  const handleAutoConnectToggle = () => {
    persistPreferences({
      wallet: {
        ...preferences.wallet,
        autoConnect: !preferences.wallet.autoConnect,
      },
    });
  };

  const handleRevealKey = () => {
    setShowPrivateKey(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      setShowPrivateKey(false);
      navigator.clipboard.writeText("").catch(() => {});
    }, 15_000);
  };

  const handleHideKey = () => {
    setShowPrivateKey(false);
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const handleCopyKey = () => {
    if (!stellarSecret) return;
    navigator.clipboard.writeText(stellarSecret);
    setCopiedKey(true);
    showToast("Secret key copied to clipboard", "success");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const clearMnemonicTimers = useCallback(() => {
    if (mnemonicTimerRef.current) clearInterval(mnemonicTimerRef.current);
    if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    mnemonicTimerRef.current = null;
    clipboardTimerRef.current = null;
  }, []);

  const handleRevealMnemonic = () => {
    setMnemonicRevealed(true);
    if (mnemonicTimerRef.current) clearInterval(mnemonicTimerRef.current);
    mnemonicTimerRef.current = setInterval(() => {
      setMnemonicRevealed(false);
      setMnemonicClipboardCountdown(0);
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      mnemonicTimerRef.current = null;
      clipboardTimerRef.current = null;
    }, 30_000);
  };

  const handleHideMnemonic = () => {
    setMnemonicRevealed(false);
    setMnemonicClipboardCountdown(0);
    clearMnemonicTimers();
  };

  const handleCopyMnemonic = () => {
    if (!stellarMnemonic) return;
    navigator.clipboard.writeText(stellarMnemonic);
    setMnemonicCopied(true);
    setMnemonicClipboardCountdown(30);
    showToast(
      "Recovery phrase copied to clipboard (auto-clearing in 30s)",
      "success"
    );

    if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    clipboardTimerRef.current = setTimeout(() => {
      navigator.clipboard.writeText("");
      setMnemonicCopied(false);
      setMnemonicClipboardCountdown(0);
    }, 30_000);
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
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to import secret key. Make sure it starts with 'S' and is 56 characters.";
      setImportError(message);
    }
  };

  const handleEncryptedExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError("");

    if (exportPassword.length < 8) {
      setExportError("Password must be at least 8 characters.");
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      setExportError("Passwords do not match.");
      return;
    }
    if (!stellarSecret) return;

    setExportLoading(true);
    try {
      const encrypted = await encryptWithPassword(
        stellarSecret,
        exportPassword
      );
      const backup = {
        _instructions:
          "ClipCash encrypted wallet backup. Import via Settings → Wallet → Advanced Mode → Import. Requires the password used during export.",
        version: 1,
        createdAt: new Date().toISOString(),
        ciphertext: encrypted,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clipcash-wallet-backup.enc.json";
      a.click();
      URL.revokeObjectURL(url);

      setExportModalOpen(false);
      setExportPassword("");
      setExportPasswordConfirm("");
      showToast("Encrypted backup downloaded successfully.", "success");
    } catch {
      setExportError("Encryption failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  // ── Privacy Handlers ──────────────────────────────────────────────────────
  const handleAnalyticsOptOutToggle = () => {
    const nextVal = !preferences.privacy.analyticsOptOut;
    analytics.setOptOut(nextVal);
    persistPreferences({
      privacy: {
        ...preferences.privacy,
        analyticsOptOut: nextVal,
      },
    });
    showToast(
      nextVal
        ? "Analytics opt-out enabled. Tracking disabled."
        : "Analytics tracking enabled.",
      "info"
    );
  };

  const handleRequestDataExport = async () => {
    setExportingData(true);
    try {
      const res = await fetch("/api/user/export-data");
      if (!res.ok) {
        throw new Error("Failed to export data");
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clipcash-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("User data export generated and downloaded", "success");
    } catch (err: any) {
      logger.error("Data export failed:", err);
      showToast(err.message || "Failed to export data", "error");
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "DELETE") {
      showToast("Please type 'DELETE' exactly to confirm deletion", "error");
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to delete account");
      }

      showToast("Account deleted successfully. Redirecting...", "success");
      setDeleteModalOpen(false);
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (err: any) {
      logger.error("Account deletion failed:", err);
      showToast(err.message || "Failed to delete account", "error");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const pageLoading = authLoading || isRestoringSession || prefsLoading;
  const isStellarConnected = isConnected && walletType === "stellar";
  const notificationSettingsUrl =
    typeof getNotificationSettingsUrl === "function"
      ? getNotificationSettingsUrl()
      : null;
  const notificationSettingsInstructions =
    typeof getNotificationSettingsInstructions === "function"
      ? getNotificationSettingsInstructions()
      : "";
  const timezones = getSupportedTimezones();

  return (
    <>
      <div className="dashboard-main max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Settings
            {isDirty && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Unsaved changes
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your account preferences, notifications, display themes, and
            wallet security.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-white/10">
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Settings sections"
            className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px scrollbar-none"
          >
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex items-center gap-2.5 px-4 py-3 border-b-2 text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isActive
                      ? "border-brand text-brand bg-brand/5 rounded-t-xl"
                      : "border-transparent text-gray-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading Skeleton */}
        {pageLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-full max-w-sm" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── TAB 1: PROFILE ─────────────────────────────────────────── */}
            {activeTab === "profile" && (
              <div
                id="panel-profile"
                role="tabpanel"
                aria-labelledby="tab-profile"
                className="space-y-6"
              >
                <form
                  onSubmit={handleSaveProfile}
                  className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Profile Information
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Update your public display name and profile avatar.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? "Saving..." : "Save Profile"}
                    </button>
                  </div>

                  {/* Avatar Upload */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-10 h-10 text-muted-foreground" />
                      )}
                      {avatarUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-white">
                        Avatar Image
                      </label>
                      <p className="text-[11px] text-muted-foreground max-w-md">
                        Maximum 1 MB file size. Accepted formats: JPEG, PNG, GIF,
                        WebP. Verified via file magic bytes.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          onChange={handleAvatarSelect}
                          onInput={handleAvatarSelect}
                          className="hidden"
                          id="avatar-file-input"
                          aria-label="Upload avatar image"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-brand/40 text-xs font-semibold text-white hover:text-brand transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Change Avatar
                        </button>
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarPreview(null);
                              if (user) setUser({ ...user, avatarUrl: null });
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {avatarError && (
                        <p className="text-xs text-red-400 mt-1">
                          {avatarError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    {/* Display Name Input */}
                    <div className="space-y-2">
                      <label
                        htmlFor="displayName"
                        className="block text-xs font-bold text-white"
                      >
                        Display Name
                      </label>
                      <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your public name"
                        className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand transition-colors"
                        maxLength={50}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Visible on public clip shares and leaderboards.
                      </p>
                    </div>

                    {/* Email Read-only with Verified Badge */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="userEmail"
                          className="block text-xs font-bold text-white"
                        >
                          Email Address
                        </label>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                          aria-label="Email verified"
                        >
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                      <input
                        id="userEmail"
                        type="email"
                        readOnly
                        disabled
                        value={user?.email || "user@clipcash.ai"}
                        className="w-full bg-input/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed select-all"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Managed by your identity authentication provider.
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* ── TAB 2: NOTIFICATIONS ───────────────────────────────────── */}
            {activeTab === "notifications" && (
              <div
                id="panel-notifications"
                role="tabpanel"
                aria-labelledby="tab-notifications"
                className="space-y-6"
              >
                {/* System Push Permission Card */}
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
                        {permission === "granted"
                          ? "Browser Push Notifications Enabled"
                          : "Browser Push Notifications Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {permission === "granted"
                          ? "Receiving instant desktop alerts when long video jobs finish."
                          : "Allow browser notifications to get alerts when rendering completes."}
                      </p>
                      {permission === "denied" && (
                        <p className="text-[11px] text-yellow-300 mt-2 max-w-md">
                          {notificationSettingsInstructions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {permission === "granted" ? (
                      <button
                        type="button"
                        onClick={handleDisableNotifications}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 text-xs font-bold transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnableNotifications}
                        disabled={notificationsLoading}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {notificationsLoading
                          ? "Enabling..."
                          : "Enable Browser Notifications"}
                      </button>
                    )}
                    {permission === "denied" && notificationSettingsUrl && (
                      <a
                        href={notificationSettingsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-300 text-xs font-bold transition-all"
                      >
                        Open Browser Settings
                      </a>
                    )}
                  </div>
                </div>

            <NotificationChannelSettings />

            <PrivacySettings />

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-muted-foreground">
                          <th className="py-3 px-4 font-bold uppercase tracking-wider">
                            Event
                          </th>
                          <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">
                            Email
                          </th>
                          <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">
                            Push
                          </th>
                          <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">
                            In-App
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {[
                          {
                            key: "job_complete" as const,
                            title: "Job Complete",
                            desc: "When video clipping and analysis finishes",
                          },
                          {
                            key: "transform_complete" as const,
                            title: "Transform Complete",
                            desc: "When AI transformation is finalized",
                          },
                          {
                            key: "mint_success" as const,
                            title: "Mint Success",
                            desc: "When an NFT clip is minted on Stellar",
                          },
                          {
                            key: "earnings_received" as const,
                            title: "Earnings Received",
                            desc: "When creator payouts and tips arrive",
                          },
                        ].map((event) => (
                          <tr
                            key={event.key}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-white">
                                {event.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {event.desc}
                              </p>
                            </td>

                            {/* Email Toggle */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={
                                  preferences.notifications.email[event.key]
                                }
                                aria-label={`Toggle email for ${event.title}`}
                                onClick={() =>
                                  handleToggleNotification("email", event.key)
                                }
                                className={`w-10 h-6 inline-flex items-center rounded-full transition-colors cursor-pointer ${
                                  preferences.notifications.email[event.key]
                                    ? "bg-brand"
                                    : "bg-white/10"
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    preferences.notifications.email[event.key]
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>

                            {/* Push Toggle */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={
                                  preferences.notifications.push[event.key]
                                }
                                aria-label={`Toggle push for ${event.title}`}
                                onClick={() =>
                                  handleToggleNotification("push", event.key)
                                }
                                className={`w-10 h-6 inline-flex items-center rounded-full transition-colors cursor-pointer ${
                                  preferences.notifications.push[event.key]
                                    ? "bg-brand"
                                    : "bg-white/10"
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    preferences.notifications.push[event.key]
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>

                            {/* In-App Toggle */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={
                                  preferences.notifications.inApp[event.key]
                                }
                                aria-label={`Toggle in-app for ${event.title}`}
                                onClick={() =>
                                  handleToggleNotification("inApp", event.key)
                                }
                                className={`w-10 h-6 inline-flex items-center rounded-full transition-colors cursor-pointer ${
                                  preferences.notifications.inApp[event.key]
                                    ? "bg-brand"
                                    : "bg-white/10"
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    preferences.notifications.inApp[event.key]
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Monthly Earnings Report Email Component */}
                <MonthlyReportSetting />
              </div>
            )}

            {/* ── TAB 3: DISPLAY ─────────────────────────────────────────── */}
            {activeTab === "display" && (
              <div
                id="panel-display"
                role="tabpanel"
                aria-labelledby="tab-display"
                className="space-y-6"
              >
                {/* Theme Selector */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      {resolvedTheme === "dark" ? (
                        <Moon className="w-6 h-6" />
                      ) : (
                        <Sun className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        Theme Preference
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Choose how ClipCash looks to you. Select System to
                        automatically match your operating system theme.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {[
                      {
                        value: "light" as const,
                        label: "Light",
                        icon: Sun,
                        desc: "Clean light palette",
                      },
                      {
                        value: "dark" as const,
                        label: "Dark",
                        icon: Moon,
                        desc: "Sleek dark mode",
                      },
                      {
                        value: "system" as const,
                        label: "System",
                        icon: Monitor,
                        desc: `Match OS (${resolvedTheme})`,
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleThemeSelect(option.value)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          theme === option.value
                            ? "bg-brand/10 border-brand text-white"
                            : "bg-white/5 border-white/10 hover:border-white/20 text-gray-300"
                        }`}
                        aria-label={`Set theme to ${option.label}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <option.icon className="w-5 h-5 text-brand" />
                          {theme === option.value && (
                            <Check className="w-4 h-4 text-brand" />
                          )}
                        </div>
                        <p className="font-bold text-sm text-white">
                          {option.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {option.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interface Language */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        Interface Language
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select your preferred localization for dashboard and
                        controls.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <LocaleSwitcher />
                  </div>
                </div>

                {/* Timezone Selector */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-white text-base">
                        Timezone
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All clip scheduling, logs, and analytics will be
                        formatted in this IANA timezone.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full">
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: preferences.display.timezone || "UTC",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZoneName: "short",
                      }).format(new Date())}
                    </span>
                  </div>

                  <div className="max-w-md">
                    <select
                      id="timezone-select"
                      aria-label="Select timezone"
                      value={preferences.display.timezone}
                      onChange={(e) => handleTimezoneSelect(e.target.value)}
                      className="w-full bg-input border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand cursor-pointer"
                    >
                      {timezones.map((tz) => (
                        <option key={tz} value={tz} className="bg-[#101614]">
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: WALLET ──────────────────────────────────────────── */}
            {activeTab === "wallet" && (
              <div
                id="panel-wallet"
                role="tabpanel"
                aria-labelledby="tab-wallet"
                className="space-y-6"
              >
                {/* Stellar Network Toggle */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">Stellar Network</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Switch between Testnet and Mainnet for your wallet
                          operations.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(["testnet", "mainnet"] as const).map((network) => (
                        <button
                          key={network}
                          type="button"
                          onClick={() => handleNetworkChange(network)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                            walletNetwork === network
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

                {/* Gas Preference & Auto-Connect */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Transaction & Connection Settings
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure gas presets and wallet behavior on startup.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gas Preset */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-white">
                        Default Gas Preset
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: "slow" as const, label: "Slow" },
                          { key: "medium" as const, label: "Medium" },
                          { key: "fast" as const, label: "Fast" },
                        ].map((g) => (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => handleGasChange(g.key)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              preferences.wallet.gasPreference === g.key
                                ? "bg-brand text-black border-brand"
                                : "bg-white/5 text-gray-300 border-white/10 hover:border-white/20"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Higher presets prioritize transactions during network
                        congestion.
                      </p>
                    </div>

                    {/* Auto-Connect Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Auto-Connect Wallet
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Restore session automatically on page load
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.wallet.autoConnect}
                        aria-label="Toggle auto-connect wallet"
                        onClick={handleAutoConnectToggle}
                        className={`w-10 h-6 inline-flex items-center rounded-full transition-colors cursor-pointer ${
                          preferences.wallet.autoConnect
                            ? "bg-brand"
                            : "bg-white/10"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            preferences.wallet.autoConnect
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multisig Link */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          Multisig Wallet Setup
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Add a second signer and require multiple approvals for
                          key transactions.
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

                {/* Biometric Passkey Wallet */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                        <Fingerprint className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          Passkey Biometric Wallet
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Use Touch ID, Face ID, or a hardware security key to
                          sign transactions.
                        </p>
                      </div>
                    </div>

                    {!passkeySupported && (
                      <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-semibold">
                        Not supported
                      </span>
                    )}
                    {passkeySupported && passkeyCredentialId && (
                      <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-brand/10 border border-brand/25 text-brand font-semibold">
                        Registered
                      </span>
                    )}
                  </div>

                  {passkeySupported && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      {passkeyCredentialId ? (
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-zinc-400">
                            Key: {passkeyCredentialId.slice(0, 24)}...
                          </p>
                          <button
                            id="passkey-reset-btn"
                            onClick={resetPasskey}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all cursor-pointer"
                          >
                            Remove Passkey
                          </button>
                        </div>
                      ) : (
                        <button
                          id="passkey-register-btn"
                          onClick={() => registerPasskey()}
                          disabled={passkeyRegistering}
                          className="px-4 py-2 rounded-xl bg-brand text-black text-xs font-extrabold hover:bg-brand-hover transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          {passkeyRegistering
                            ? "Registering…"
                            : "Register Passkey"}
                        </button>
                      )}
                      {passkeyError && (
                        <p className="text-xs text-red-400 mt-2">
                          {passkeyError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Advanced Wallet Mode */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          Developer & Wallet Mode
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Toggle to reveal cryptographic secret keys and seed
                          backups.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAdvancedWalletEnabled(!advancedWalletEnabled)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        advancedWalletEnabled ? "bg-brand" : "bg-white/10"
                      }`}
                      aria-label="Toggle Advanced Wallet Mode"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          advancedWalletEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {advancedWalletEnabled && (
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      {isStellarConnected ? (
                        <div className="space-y-5">
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                              Connected Stellar Address
                            </span>
                            <p className="text-xs font-mono text-white break-all">
                              {address}
                            </p>
                          </div>

                          {/* Secret Key Export */}
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                              <p className="font-bold text-sm text-white">
                                Secret Key Export (Secure)
                              </p>
                              <p className="text-xs text-muted-foreground max-w-md">
                                Never share your Stellar Secret Key. Export
                                requires confirmation.
                              </p>
                              {showPrivateKey && (
                                <p className="text-xs font-mono text-brand break-all bg-brand/5 border border-brand/20 p-2 rounded-lg mt-2 select-all">
                                  {stellarSecret}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0 items-center flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  showPrivateKey
                                    ? handleHideKey()
                                    : handleRevealKey()
                                }
                                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:text-brand hover:border-brand/30 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                {showPrivateKey ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                {showPrivateKey ? "Hide" : "Reveal"}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setExportModalOpen(true);
                                  setExportError("");
                                  setExportPassword("");
                                  setExportPasswordConfirm("");
                                }}
                                disabled={!stellarSecret}
                                className="px-3 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Export (Encrypted)
                              </button>

                              {showPrivateKey && (
                                <button
                                  type="button"
                                  onClick={handleCopyKey}
                                  className="px-3 py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedKey ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                  Copy
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Mnemonic Phrase */}
                          {stellarMnemonic && (
                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-sm text-white">
                                  Recovery Mnemonic Phrase
                                </p>
                                {mnemonicRevealed && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 border border-brand/25 text-brand uppercase font-mono flex items-center gap-1">
                                    <TimerOff className="w-3 h-3" /> Auto-hide
                                    in 30s
                                  </span>
                                )}
                              </div>
                              <div
                                className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${
                                  mnemonicRevealed ? "" : "blur-sm select-none"
                                }`}
                              >
                                {stellarMnemonic
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 12)
                                  .map((word, idx) => (
                                    <div
                                      key={`${word}-${idx}`}
                                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white font-mono"
                                    >
                                      <span className="text-muted-foreground mr-1">
                                        {idx + 1}.
                                      </span>
                                      {mnemonicRevealed
                                        ? word
                                        : word[0] + "•••"}
                                    </div>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    mnemonicRevealed
                                      ? handleHideMnemonic()
                                      : handleRevealMnemonic()
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:text-brand transition-all cursor-pointer"
                                >
                                  {mnemonicRevealed ? "Hide" : "Reveal words"}
                                </button>
                                {mnemonicRevealed && (
                                  <button
                                    type="button"
                                    onClick={handleCopyMnemonic}
                                    className="px-3 py-1.5 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all cursor-pointer"
                                  >
                                    {mnemonicCopied
                                      ? `Copied (${mnemonicClipboardCountdown}s)`
                                      : "Copy all words"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Social Recovery and Trustlines */}
                          <SocialRecoveryConfig />
                          <TrustlineManager
                            publicKey={address!}
                            secretKey={stellarSecret}
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground text-center">
                            Stellar wallet is disconnected. Connect a wallet or
                            import a private key.
                          </p>
                          <div className="max-w-md mx-auto">
                            <WalletConnectButton />
                          </div>

                          <form
                            onSubmit={handleImportKeySubmit}
                            className="space-y-3 pt-4 border-t border-white/5"
                          >
                            <label className="block text-xs font-bold text-white">
                              Import Stellar Private Key
                            </label>
                            <input
                              type="password"
                              placeholder="Starts with 'S'... (56 characters)"
                              value={importKeyInput}
                              onChange={(e) =>
                                setImportKeyInput(e.target.value)
                              }
                              className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand"
                            />
                            {importError && (
                              <p className="text-xs text-red-400">
                                {importError}
                              </p>
                            )}
                            {importSuccess && (
                              <p className="text-xs text-emerald-400">
                                Key imported successfully!
                              </p>
                            )}
                            <button
                              type="submit"
                              className="w-full py-2.5 rounded-xl border border-white/10 hover:border-brand/40 text-xs font-bold text-white hover:text-brand transition-colors cursor-pointer"
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
            )}

            {/* ── TAB 5: PRIVACY ─────────────────────────────────────────── */}
            {activeTab === "privacy" && (
              <div
                id="panel-privacy"
                role="tabpanel"
                aria-labelledby="tab-privacy"
                className="space-y-6"
              >
                {/* Analytics Opt-Out */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">
                      Analytics & Telemetry
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-lg">
                      Opt out of all performance evaluation metrics, page view
                      tracking, and usage analytics.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.privacy.analyticsOptOut}
                    aria-label="Opt out of analytics tracking"
                    onClick={handleAnalyticsOptOutToggle}
                    className={`w-12 h-7 inline-flex items-center rounded-full transition-colors cursor-pointer ${
                      preferences.privacy.analyticsOptOut
                        ? "bg-brand"
                        : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        preferences.privacy.analyticsOptOut
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Explore Privacy */}
                <PrivacySettings />

                {/* Data Export Request */}
                <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">
                      Export Your Data
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-lg">
                      Download a complete, machine-readable JSON archive of your
                      account profile, preferences, clip metadata, and audit logs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestDataExport}
                    disabled={exportingData}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-brand/40 text-xs font-bold text-white hover:text-brand transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    {exportingData ? "Generating Export..." : "Download JSON Archive"}
                  </button>
                </div>

                {/* Danger Zone: Account Deletion */}
                <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-400 text-base">
                        Delete Account
                      </h3>
                      <p className="text-xs text-red-300/80 mt-0.5">
                        Permanently delete your account, clips, API keys, and
                        preferences. This cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmationText("");
                        setDeleteModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ClipCash Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Encrypted Wallet Export Modal ───────────────────────────────────── */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
        >
          <div className="w-full max-w-sm bg-[#080B0A] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setExportModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              aria-label="Close export modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="export-modal-title"
                  className="font-bold text-white text-sm"
                >
                  Export Encrypted Backup
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Set a password to protect your secret key.
                </p>
              </div>
            </div>

            <form onSubmit={handleEncryptedExport} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="export-password"
                  className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Encryption Password
                </label>
                <input
                  id="export-password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="export-password-confirm"
                  className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Confirm Password
                </label>
                <input
                  id="export-password-confirm"
                  type="password"
                  placeholder="Re-enter password"
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  className="w-full bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none"
                  autoComplete="new-password"
                />
              </div>

              {exportError && (
                <p className="text-xs text-red-400 font-semibold">
                  {exportError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  exportLoading || !exportPassword || !exportPasswordConfirm
                }
                className="w-full py-3 rounded-xl bg-brand text-black text-xs font-extrabold hover:bg-brand-hover transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportLoading ? "Encrypting…" : "Download Encrypted Backup"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Account Deletion Confirmation Modal ────────────────────────────── */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
        >
          <div className="w-full max-w-md bg-[#101614] border border-red-500/30 rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              aria-label="Close delete modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="delete-account-modal-title"
                  className="font-bold text-white text-base"
                >
                  Delete Account Permanently?
                </h2>
                <p className="text-xs text-muted-foreground">
                  This action is irreversible and immediate.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              All active video rendering jobs, generated clips, connected API
              keys, webhook endpoints, and preferences will be permanently wiped
              from our database.
            </p>

            <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl space-y-2">
              <label
                htmlFor="delete-confirm-input"
                className="block text-[11px] font-bold text-red-300 uppercase tracking-wider"
              >
                Type <span className="text-white underline">DELETE</span> to
                confirm:
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-input border border-red-500/40 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-400"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  isDeletingAccount || deleteConfirmationText !== "DELETE"
                }
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingAccount
                  ? "Deleting..."
                  : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SettingsPage;
