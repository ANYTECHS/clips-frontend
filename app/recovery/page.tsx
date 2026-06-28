"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";
import { restoreWalletFromMnemonic } from "@/app/lib/stellar";
import { decryptWithPassword } from "@/components/SocialRecoveryConfig";
import { secureStorage } from "@/app/lib/secureStorage";
import {
  Shield,
  Key,
  Mail,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export default function RecoveryPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { importStellarKey, connectStellar } = useWallet();

  const [activeTab, setActiveTab] = useState<"mnemonic" | "social">("mnemonic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mnemonic State
  const [mnemonicInput, setMnemonicInput] = useState("");

  // Social Recovery State
  const [socialEmail, setSocialEmail] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [guardians, setGuardians] = useState<{ email: string; approved: boolean }[]>([]);
  const [recoveryThreshold, setRecoveryThreshold] = useState(2);
  const [recoveryGuardianCount, setRecoveryGuardianCount] = useState(0);
  const [isRecoverable, setIsRecoverable] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [simulating, setSimulating] = useState(false);

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
      setError(err.message || "Failed to recover wallet from mnemonic phrase.");
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateSocialRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!socialEmail) {
      setError("Please enter your account email address.");
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
    } catch (err: any) {
      setError(err.message || "Failed to find social recovery setup for this email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateApprovals = async () => {
    if (!sessionId || guardians.length === 0) return;
    setSimulating(true);
    setError("");

    try {
      // Simulate Guardian 1 approving
      await new Promise((r) => setTimeout(r, 1000));
      let r = await fetch("/api/recovery/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, guardianEmail: guardians[0].email }),
      });
      let res = await r.json();
      setGuardians(
        res.guardians.map((g: { email: string; approved: boolean }) => ({
          email: g.email,
          approved: g.approved,
        }))
      );

      await new Promise((r) => setTimeout(r, 1200));
      r = await fetch("/api/recovery/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, guardianEmail: guardians[1].email }),
      });
      res = await r.json();
      setGuardians(
        res.guardians.map((g: { email: string; approved: boolean }) => ({
          email: g.email,
          approved: g.approved,
        }))
      );

      // Verify recovery capability
      const statusR = await fetch(`/api/recovery/check?sessionId=${encodeURIComponent(sessionId)}`);
      const status = await statusR.json();
      setIsRecoverable(status.isRecoverable);
      setSuccess("Threshold reached! Guardians have approved your request.");
    } catch (err: any) {
      setError(err.message || "Simulation failed.");
    } finally {
      setSimulating(false);
    }
  };

  const handleCompleteSocialRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!recoveryPassword) {
      setError("Please enter your recovery password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch encrypted backup from session
      const r = await fetch(`/api/recovery/check?sessionId=${encodeURIComponent(sessionId)}`);
      if (!r.ok) throw new Error((await r.json()).error ?? "Recovery check failed");
      const status = await r.json();
      if (!status.isRecoverable || !status.encryptedBackup) {
        throw new Error("Social recovery is not approved yet.");
      }

      // 2. Decrypt the key using user's password
      const decryptedBackup = await decryptWithPassword(status.encryptedBackup, recoveryPassword);
      
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
      setError(err.message || "Decryption failed. Please check your recovery password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030605] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand/5 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand/[0.02] blur-[100px] rounded-full pointer-events-none" />

      {/* Navigation Header */}
      <header className="p-6 border-b border-white/5 bg-[#050807]/30 backdrop-blur-md flex items-center justify-between relative z-10">
        <Link href="/login" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
        <span className="text-xs font-black tracking-widest text-brand uppercase">CLIPCASH WALLET</span>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md bg-[#080B0A] border border-white/5 rounded-[28px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />
          
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand mx-auto mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Secure Wallet Recovery</h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Restore your Stellar keys and account access using your backup configurations.
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-[#121915] p-1 rounded-xl mb-6">
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
                <label htmlFor="mnemonic" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Enter 12-Word Phrase
                </label>
                <textarea
                  id="mnemonic"
                  rows={3}
                  placeholder="Paste your 12 recovery words separated by spaces here..."
                  value={mnemonicInput}
                  onChange={(e) => setMnemonicInput(e.target.value)}
                  className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3.5 text-xs focus:outline-none transition-colors font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex gap-2.5">
                <Key className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Your seed phrase derived key pair remains strictly client-side. The recovery process decrypts and registers keys in secure local memory.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !mnemonicInput}
                className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Restoring Wallet...</>
                ) : (
                  <>
                    <span>Recover Wallet</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Social Recovery Form */}
          {activeTab === "social" && (
            <div className="space-y-5">
              {!sessionId ? (
                <form onSubmit={handleInitiateSocialRecovery} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Account Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        type="email"
                        placeholder="your-email@example.com"
                        value={socialEmail}
                        onChange={(e) => setSocialEmail(e.target.value)}
                        className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl pl-10 pr-4 py-3.5 text-xs focus:outline-none transition-colors"
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
                      <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Configuration...</>
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
                  {/* Guardian approval tracking */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand" /> Guardian Approvals
                      </span>
                      <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full">
                        {guardians.filter((g) => g.approved).length} / {recoveryThreshold} required (
                        {recoveryThreshold}-of-{recoveryGuardianCount})
                      </span>
                    </div>

                    <div className="bg-[#111613] border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden">
                      {guardians.map((guardian, i) => (
                        <div key={i} className="px-4 py-3 flex items-center justify-between text-xs">
                          <span className="text-white font-medium truncate max-w-[200px]">{guardian.email}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                              guardian.approved
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                : "bg-yellow-500/5 text-yellow-400 border border-yellow-500/20"
                            }`}
                          >
                            {guardian.approved ? "Approved" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isRecoverable && (
                    <button
                      type="button"
                      onClick={handleSimulateApprovals}
                      disabled={simulating}
                      className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      {simulating ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Gathering Guardian Signatures...</>
                      ) : (
                        "Simulate Guardian Approvals"
                      )}
                    </button>
                  )}

                  {isRecoverable && (
                    <form onSubmit={handleCompleteSocialRecovery} className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label htmlFor="recovery-password" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-brand" /> Decrypt Recovery Secret
                        </label>
                        <input
                          id="recovery-password"
                          type="password"
                          placeholder="Enter your recovery password"
                          value={recoveryPassword}
                          onChange={(e) => setRecoveryPassword(e.target.value)}
                          className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3.5 text-xs focus:outline-none transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !recoveryPassword}
                        className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        {loading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Decrypting Keypair...</>
                        ) : (
                          "Decrypt & Restore Wallet"
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
