"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Key,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { decryptWithPassword } from "@/app/lib/cryptoUtils";
import { FAILURE_MESSAGES, safeErrorMessage, VALIDATION_MESSAGES } from "@/app/lib/errorMessages";
import { secureStorage } from "@/app/lib/secureStorage";
import { restoreWalletFromMnemonic } from "@/app/lib/stellar";
import { useAuth } from "@/components/auth/AuthProvider";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import { GuardianShareTool } from "@/components/SocialRecoveryConfig/GuardianShareTool";
import { useWalletActions } from "@/components/wallet/WalletProvider";

export default function RecoveryPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  // Only actions are needed here, so this never re-renders on wallet state
  // changes (connection status, address, etc.) elsewhere in the app.
  const { importStellarKey, connectStellar } = useWalletActions();

  const [activeTab, setActiveTab] = useState<"mnemonic" | "social" | "encrypted" | "guardian">(
    "mnemonic"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mnemonic State
  const [mnemonicInput, setMnemonicInput] = useState("");

  // Encrypted Backup State
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [encryptedPassword, setEncryptedPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Social Recovery State
  const [socialEmail, setSocialEmail] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [guardians, setGuardians] = useState<{ email: string; approved: boolean }[]>([]);
  const [recoveryThreshold, setRecoveryThreshold] = useState(2);
  const [recoveryGuardianCount, setRecoveryGuardianCount] = useState(0);
  const [isRecoverable, setIsRecoverable] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [guardianShares, setGuardianShares] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [guardianLink, setGuardianLink] = useState({ session: "", guardian: "" });

  const collectedShares = Object.values(guardianShares)
    .map((s) => s.trim())
    .filter(Boolean);

  const applyStatus = (status: {
    guardians: { email: string; approved: boolean }[];
    threshold: number;
    totalCount: number;
    isRecoverable: boolean;
  }) => {
    setGuardians(status.guardians.map((g) => ({ email: g.email, approved: g.approved })));
    setRecoveryThreshold(status.threshold);
    setRecoveryGuardianCount(status.totalCount);
    setIsRecoverable(status.isRecoverable);
  };

  // Deep links: guardians land here from their approval email, and the owner
  // lands here from their email verification link. Read from window.location
  // so the page does not need a Suspense boundary for useSearchParams.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session") ?? "";
    const guardian = params.get("guardian");
    const verify = params.get("verify");

    if (guardian) {
      setGuardianLink({ session, guardian });
      setActiveTab("guardian");
      return;
    }

    if (session && verify) {
      setActiveTab("social");
      setSessionId(session);
      setVerificationToken(verify);
      fetch(`/api/recovery/check?sessionId=${encodeURIComponent(session)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error ?? "Recovery check failed");
          applyStatus(await r.json());
        })
        .catch((err) => {
          setSessionId("");
          setError(safeErrorMessage(err, FAILURE_MESSAGES.findSocialRecovery, "load recovery"));
        });
    }
  }, []);

  const handleMnemonicRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const phrase = mnemonicInput.trim().toLowerCase().replace(/\s+/g, " ");
    const wordCount = phrase.split(" ").length;

    if (wordCount !== 12) {
      setError(`Invalid mnemonic. Expected 12 words, but got ${wordCount}.`);
      return;
    }

    setLoading(true);
    try {
      // 1. Reconstruct Stellar wallet
      const wallet = await restoreWalletFromMnemonic(phrase);

      // 2. Load Stellar keys into secureStorage & wallet state
      await importStellarKey(wallet.secretKey);

      // Sync the mnemonic phrase into storage if generated
      const stored = await secureStorage.getItem("clipcash_wallet");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.stellarMnemonic = phrase;
        await secureStorage.setItem("clipcash_wallet", JSON.stringify(parsed));
      }

      // 3. Authenticate user as a recovered account
      const loggedInUser = {
        id: "recovered-user-id",
        email: "recovered@clipcash.ai",
        username: "recovered_user",
        onboardingStep: 3,
        name: "Recovered User",
      };

      setUser(loggedInUser);
      setSuccess("Wallet recovered successfully! Redirecting...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(
        safeErrorMessage(err, FAILURE_MESSAGES.recoverFromMnemonic, "recover from mnemonic")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateSocialRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!socialEmail) {
      setError(VALIDATION_MESSAGES.emailRequired);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/recovery/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: socialEmail }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to initiate recovery");
      const res = await r.json();
      setSessionId(res.sessionId);
      setGuardians(res.guardians.map((g: string) => ({ email: g, approved: false })));
      setRecoveryThreshold(res.threshold);
      setRecoveryGuardianCount(res.guardianCount);
      setIsRecoverable(false);
      setGuardianShares({});
    } catch (err: any) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.findSocialRecovery, "find social recovery"));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshApprovals = async () => {
    if (!sessionId) return;
    setRefreshing(true);
    setError("");
    try {
      const r = await fetch(`/api/recovery/check?sessionId=${encodeURIComponent(sessionId)}`);
      if (!r.ok) throw new Error((await r.json()).error ?? "Recovery check failed");
      applyStatus(await r.json());
    } catch (err: any) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.findSocialRecovery, "refresh approvals"));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCompleteSocialRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!verificationToken.trim()) {
      setError("Open the verification link sent to your email, or paste its token below.");
      return;
    }
    if (collectedShares.length < recoveryThreshold) {
      setError(
        `Collect at least ${recoveryThreshold} guardian shares (${collectedShares.length} entered).`
      );
      return;
    }
    if (!recoveryPassword) {
      setError(VALIDATION_MESSAGES.recoveryPasswordRequired);
      return;
    }

    setLoading(true);
    try {
      // 1. Combine the guardian-released shares server-side (email verified)
      const r = await fetch("/api/recovery/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          verificationToken: verificationToken.trim(),
          shares: collectedShares,
        }),
      });
      const res = await r.json();
      if (!r.ok || !res.recoveredKey) {
        throw new Error(res.error ?? "Recovery failed");
      }

      // 2. Decrypt the recovered backup locally with the user's password
      const decryptedBackup = await decryptWithPassword(res.recoveredKey, recoveryPassword);

      // 3. Restore and set session
      let wallet;
      if (decryptedBackup.startsWith("S") && decryptedBackup.length === 56) {
        // Is secret key
        await importStellarKey(decryptedBackup);
      } else {
        // Is mnemonic phrase
        wallet = await restoreWalletFromMnemonic(decryptedBackup);
        await importStellarKey(wallet.secretKey);

        // Sync mnemonic
        const stored = await secureStorage.getItem("clipcash_wallet");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.stellarMnemonic = decryptedBackup;
          await secureStorage.setItem("clipcash_wallet", JSON.stringify(parsed));
        }
      }

      // 4. Log user in
      const loggedInUser = {
        id: "recovered-user-id",
        email: socialEmail,
        username: "recovered_user",
        onboardingStep: 3,
        name: "Recovered User",
      };

      setUser(loggedInUser);
      setSuccess("Wallet decrypted and restored! Redirecting to Dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.decryptBackup, "decrypt recovery password"));
    } finally {
      setLoading(false);
    }
  };

  const handleEncryptedBackupRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!encryptedFile) {
      setError(VALIDATION_MESSAGES.backupFileRequired);
      return;
    }
    if (!encryptedPassword) {
      setError(VALIDATION_MESSAGES.backupPasswordRequired);
      return;
    }

    setLoading(true);
    try {
      const text = await encryptedFile.text();
      const backup = JSON.parse(text) as { ciphertext?: string; version?: number };
      if (!backup.ciphertext) {
        throw new Error(
          "Invalid backup file format. Expected a clipcash-wallet-backup.enc.json file."
        );
      }

      const decrypted = await decryptWithPassword(backup.ciphertext, encryptedPassword);

      if (decrypted.startsWith("S") && decrypted.length === 56) {
        await importStellarKey(decrypted);
      } else {
        const wallet = await restoreWalletFromMnemonic(decrypted);
        await importStellarKey(wallet.secretKey);
        const stored = await secureStorage.getItem("clipcash_wallet");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.stellarMnemonic = decrypted;
          await secureStorage.setItem("clipcash_wallet", JSON.stringify(parsed));
        }
      }

      const loggedInUser = {
        id: "recovered-user-id",
        email: "",
        username: "recovered_user",
        onboardingStep: 3,
        name: "Recovered User",
      };
      setUser(loggedInUser);
      setSuccess("Wallet restored from encrypted backup! Redirecting to Dashboard…");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (
        msg.includes("decrypt") ||
        msg.includes("key") ||
        msg.toLowerCase().includes("operation")
      ) {
        setError(FAILURE_MESSAGES.decryptBackup);
      } else {
        setError(safeErrorMessage(err, FAILURE_MESSAGES.restoreFromBackup, "restore from backup"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030605] text-white flex flex-col font-sans relative overflow-hidden">
      <BackgroundOrbs variant="subtle" />

      {/* Navigation Header */}
      <header className="p-6 border-b border-white/5 bg-[#050807]/30 backdrop-blur-md flex items-center justify-between relative z-10">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
        <span className="text-xs font-black tracking-widest text-brand uppercase">
          CLIPCASH WALLET
        </span>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md bg-[#080B0A] border border-white/5 rounded-[28px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />

          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Secure Wallet Recovery
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Restore your Stellar keys and account access using your backup configurations.
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-[#121915] p-1 rounded-xl mb-6">
            <button
              onClick={() => {
                setActiveTab("mnemonic");
                setError("");
                setSuccess("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "mnemonic"
                  ? "bg-brand text-black shadow-lg"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Mnemonic Phrase
            </button>
            <button
              onClick={() => {
                setActiveTab("encrypted");
                setError("");
                setSuccess("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "encrypted"
                  ? "bg-brand text-black shadow-lg"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Encrypted Backup
            </button>
            <button
              onClick={() => {
                setActiveTab("social");
                setError("");
                setSuccess("");
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "social"
                  ? "bg-brand text-black shadow-lg"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Social Recovery
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab("guardian");
              setError("");
              setSuccess("");
            }}
            className={`w-full -mt-3 mb-6 text-[10px] font-bold transition-colors cursor-pointer ${
              activeTab === "guardian" ? "text-brand" : "text-muted-foreground hover:text-white"
            }`}
          >
            Are you a guardian? Manage your guardian key or release a share
          </button>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-950/45 border border-red-500/20 flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-normal">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-950/45 border border-emerald-500/20 flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 leading-normal">{success}</p>
            </div>
          )}

          {/* Tab 1: Mnemonic Phrase Form */}
          {activeTab === "mnemonic" && (
            <form onSubmit={handleMnemonicRecovery} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="mnemonic"
                  className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Enter 12-Word Phrase
                </label>
                <textarea
                  id="mnemonic"
                  rows={3}
                  placeholder="Paste your 12 recovery words separated by spaces here..."
                  value={mnemonicInput}
                  onChange={(e) => setMnemonicInput(e.target.value)}
                  className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex gap-2.5">
                <Key className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Your seed phrase derived key pair remains strictly client-side. The recovery
                  process decrypts and registers keys in secure local memory.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !mnemonicInput}
                className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Restoring Wallet...
                  </>
                ) : (
                  <>
                    <span>Recover Wallet</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Encrypted Backup Form */}
          {activeTab === "encrypted" && (
            <form onSubmit={handleEncryptedBackupRecovery} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Backup File
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-[#111613] border border-dashed border-white/10 hover:border-brand/40 rounded-xl px-4 py-5 text-xs text-muted-foreground flex flex-col items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 text-brand" />
                  {encryptedFile ? (
                    <span className="text-white font-medium">{encryptedFile.name}</span>
                  ) : (
                    <span>
                      Click to select{" "}
                      <strong className="text-white">clipcash-wallet-backup.enc.json</strong>
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => setEncryptedFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="encrypted-password"
                  className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Backup Password
                </label>
                <div className="relative">
                  <input
                    id="encrypted-password"
                    type="password"
                    placeholder="Password set during export"
                    value={encryptedPassword}
                    onChange={(e) => setEncryptedPassword(e.target.value)}
                    className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl pl-10 pr-4 py-3.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
                    autoComplete="current-password"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex gap-2.5">
                <Key className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Decryption is performed entirely client-side using AES-GCM. Your password never
                  leaves your device.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !encryptedFile || !encryptedPassword}
                className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Decrypting Backup…
                  </>
                ) : (
                  <>
                    <span>Restore from Backup</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === "guardian" && (
            <GuardianShareTool
              initialSessionId={guardianLink.session}
              initialGuardianEmail={guardianLink.guardian}
            />
          )}

          {/* Tab 3: Social Recovery Form */}
          {activeTab === "social" && (
            <div className="space-y-5">
              {!sessionId ? (
                <form onSubmit={handleInitiateSocialRecovery} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      Account Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        placeholder="your-email@example.com"
                        value={socialEmail}
                        onChange={(e) => setSocialEmail(e.target.value)}
                        className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl pl-10 pr-4 py-3.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !socialEmail}
                    className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Configuration...
                      </>
                    ) : (
                      <>
                        <span>Find Social Backup</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Step 1: email verification */}
                  <div className="space-y-2">
                    <label
                      htmlFor="verification-token"
                      className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-brand" /> 1. Verify your email
                    </label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      We sent a verification link to your account email. Open it on this device,
                      or paste the token from the link here.
                    </p>
                    <input
                      id="verification-token"
                      type="text"
                      placeholder="Verification token"
                      value={verificationToken}
                      onChange={(e) => setVerificationToken(e.target.value)}
                      className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors font-mono"
                    />
                  </div>

                  {/* Step 2: request shares from guardians */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand" /> 2. Collect guardian shares
                      </span>
                      <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
                        {collectedShares.length} / {recoveryThreshold} required ({recoveryThreshold}
                        -of-{recoveryGuardianCount})
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Each guardian received an approval email. After approving, they decrypt
                      their share with their guardian key and send it to you. Ask at least{" "}
                      {recoveryThreshold} guardians, then paste each share below. Session ID to
                      share with guardians: <span className="font-mono text-white">{sessionId}</span>
                    </p>

                    <div className="bg-[#111613] border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
                      {guardians.map((guardian, i) => (
                        <div key={guardian.email} className="px-4 py-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium truncate max-w-[200px]">
                              {guardian.email}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                                guardianShares[guardian.email]?.trim()
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                  : guardian.approved
                                    ? "bg-brand/10 text-brand border border-brand/25"
                                    : "bg-yellow-500/5 text-yellow-400 border border-yellow-500/20"
                              }`}
                            >
                              {guardianShares[guardian.email]?.trim()
                                ? "Share received"
                                : guardian.approved
                                  ? "Approved"
                                  : "Pending"}
                            </span>
                          </div>
                          <textarea
                            aria-label={`Share from guardian ${i + 1}`}
                            rows={2}
                            placeholder="Paste the share this guardian sent you"
                            value={guardianShares[guardian.email] ?? ""}
                            onChange={(e) =>
                              setGuardianShares((prev) => ({
                                ...prev,
                                [guardian.email]: e.target.value,
                              }))
                            }
                            className="w-full bg-black/30 border border-white/5 text-white focus:border-brand/40 rounded-lg px-3 py-2 text-[10px] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-brand resize-none"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleRefreshApprovals}
                      disabled={refreshing}
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-white font-bold text-xs hover:border-brand/25 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh guardian approvals
                      {isRecoverable ? " (threshold approved)" : ""}
                    </button>
                  </div>

                  {/* Step 3: combine + decrypt */}
                  <form
                    onSubmit={handleCompleteSocialRecovery}
                    className="space-y-4 pt-2 border-t border-white/5"
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="recovery-password"
                        className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5 text-brand" /> 3. Decrypt Recovery Secret
                      </label>
                      <input
                        id="recovery-password"
                        type="password"
                        placeholder="Enter your recovery password"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !recoveryPassword ||
                        !verificationToken ||
                        collectedShares.length < recoveryThreshold
                      }
                      className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Recovering Keypair...
                        </>
                      ) : (
                        "Combine Shares & Restore Wallet"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
