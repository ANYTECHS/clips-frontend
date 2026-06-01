"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "./WalletProvider";
import { useAuth } from "./AuthProvider";
import { MockApi } from "@/app/lib/mockApi";
import { Shield, Plus, Trash2, KeyRound, Check, Loader2, AlertCircle } from "lucide-react";

// AES-GCM password-based encryption helper
export const encryptWithPassword = async (data: string, password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(data)
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
};

// AES-GCM password-based decryption helper
export const decryptWithPassword = async (encryptedBase64: string, password: string): Promise<string> => {
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  const passwordMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted)
  );
};

export default function SocialRecoveryConfig() {
  const { user, setUser } = useAuth();
  const { isConnected, walletType, stellarMnemonic, stellarSecret } = useWallet();

  const [guardians, setGuardians] = useState<string[]>(["", "", ""]);
  const [threshold, setThreshold] = useState(2);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isStellar = isConnected && walletType === "stellar";

  useEffect(() => {
    if (user?.socialRecoveryGuardianCount && user.socialRecoveryGuardianCount > 0) {
      const count = Math.max(user.socialRecoveryGuardianCount, 3);
      setGuardians(Array.from({ length: count }, () => ""));
      setThreshold(user.socialRecoveryThreshold ?? 2);
    }
  }, [user]);

  const handleGuardianChange = (index: number, val: string) => {
    const next = [...guardians];
    next[index] = val.trim();
    setGuardians(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!isStellar) {
      setError("Please connect your Stellar wallet first.");
      return;
    }

    const backupData = stellarMnemonic || stellarSecret;
    if (!backupData) {
      setError("No Stellar private key or recovery phrase found in active session.");
      return;
    }

    // Filter out empty guardian fields
    const activeGuardians = guardians.filter((g) => g.length > 0);
    if (activeGuardians.length < 2) {
      setError("Please configure at least 2 guardians to enable social recovery.");
      return;
    }

    if (threshold < 2 || threshold > activeGuardians.length) {
      setError(
        `Recovery threshold must be between 2 and ${activeGuardians.length} (you have ${activeGuardians.length} guardians).`
      );
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const g of activeGuardians) {
      if (!emailRegex.test(g)) {
        setError(`Invalid guardian email format: "${g}"`);
        return;
      }
    }

    if (!password || password.length < 6) {
      setError("Please choose a recovery password of at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Encrypt key data with user chosen password
      const cipherText = await encryptWithPassword(backupData, password);

      // 2. Save recovery configuration to backend
      if (user?.email) {
        const saved = await MockApi.saveSocialRecoveryConfig(
          user.email,
          activeGuardians,
          cipherText,
          threshold
        );
        setUser({
          ...user,
          socialRecoveryThreshold: saved.threshold,
          socialRecoveryGuardianCount: saved.guardianCount,
        });

        setSuccess(true);
        setPassword("");
        setTimeout(() => setSuccess(false), 5000);
      } else {
        throw new Error("No authenticated user session found.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to configure social recovery.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Shield className="w-32 h-32 text-brand" />
      </div>

      <div className="flex items-start gap-4.5 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-[16px] font-extrabold text-white">Social Wallet Recovery</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Assign trusted guardians by email. Your wallet backup is split with Shamir secret sharing;
            recovery requires approval from at least your chosen threshold of guardians, plus your
            recovery password. Guardian invitations are sent by email (mocked in this environment).
          </p>
        </div>
      </div>

      {!isStellar ? (
        <div className="p-5 border border-dashed border-white/10 rounded-xl bg-white/[0.01] text-center">
          <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">
            Connect your Stellar wallet in advanced settings to enable social recovery.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-3">
            <label className="block text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
              Configure Guardians (Emails)
            </label>
            {guardians.map((guardian, i) => (
              <div key={i} className="relative">
                <input
                  type="email"
                  placeholder={`Guardian #${i + 1} Email`}
                  value={guardian}
                  onChange={(e) => handleGuardianChange(i, e.target.value)}
                  className="w-full bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none transition-colors"
                />
              </div>
            ))}
            <span className="text-[10px] text-muted-foreground mt-1.5 block">
              Configure at least 2 guardians. Each receives an email invitation with their secret share.
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-muted-foreground tracking-wider uppercase">
              Recovery threshold (t-of-n)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={2}
                max={Math.max(2, guardians.filter((g) => g.length > 0).length || 3)}
                value={threshold}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  const activeCount = guardians.filter((g) => g.length > 0).length || 3;
                  setThreshold(
                    Math.min(Math.max(2, next), Math.max(2, activeCount))
                  );
                }}
                className="w-20 bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
              <span className="text-[10px] text-muted-foreground">
                Require{" "}
                <strong className="text-white">{threshold}</strong> of{" "}
                <strong className="text-white">
                  {guardians.filter((g) => g.length > 0).length || "n"}
                </strong>{" "}
                guardians to approve recovery before your key can be restored.
              </span>
            </div>
          </div>

          <div className="h-px bg-white/5 my-4" />

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand" /> Set Recovery Password
            </label>
            <input
              type="password"
              placeholder="Recovery decryption password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-3 text-xs focus:outline-none transition-colors"
            />
            <span className="text-[10px] text-muted-foreground mt-1.5 block">
              This password is never stored on the server. You must remember it to decrypt your key upon recovery.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-center">
              <span className="text-xs text-red-400 font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-bold">Social recovery configuration updated successfully!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-[13px] hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Updating Configuration...</>
            ) : (
              "Save Recovery Configuration"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
