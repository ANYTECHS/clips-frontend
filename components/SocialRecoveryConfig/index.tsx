"use client";

import React, { useState } from "react";
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { encryptWithPassword } from "@/app/lib/cryptoUtils";
import { splitSecret } from "@/app/lib/shamirRecovery";
import { MockApi } from "@/app/lib/mockApi";
import { secureStorage } from "@/app/lib/secureStorage";

export { encryptWithPassword, decryptWithPassword } from "@/app/lib/cryptoUtils";

export default function SocialRecoveryConfig() {
  const { showToast } = useToast();
  const [guardians, setGuardians] = useState<{ email: string; name: string }[]>([
    { email: "", name: "" },
  ]);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const addGuardian = () => {
    if (guardians.length >= 6) return;
    setGuardians([...guardians, { email: "", name: "" }]);
  };

  const removeGuardian = (index: number) => {
    if (guardians.length <= 1) return;
    const updated = guardians.filter((_, i) => i !== index);
    setGuardians(updated);
    if (threshold > updated.length) {
      setThreshold(Math.max(2, updated.length));
    }
  };

  const updateGuardian = (index: number, field: "email" | "name", value: string) => {
    const updated = [...guardians];
    updated[index][field] = value;
    setGuardians(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);

    const validGuardians = guardians.filter((g) => g.email.trim());
    if (validGuardians.length < 2) {
      setError("Add at least two guardians with email addresses.");
      return;
    }
    if (!recoveryPassword) {
      setError("Please set a recovery password.");
      return;
    }

    setSaving(true);
    try {
      const stored = await secureStorage.getItem("clipcash_wallet");
      if (!stored) {
        throw new Error("No wallet found. Please connect or create a wallet first.");
      }

      const parsed = JSON.parse(stored);
      const backupPayload = parsed.stellarSecret || parsed.stellarMnemonic;
      if (!backupPayload) {
        throw new Error("No wallet secret or mnemonic available for backup.");
      }

      const encryptedBackup = await encryptWithPassword(backupPayload, recoveryPassword);
      const shares = splitSecret(encryptedBackup, {
        shares: validGuardians.length,
        threshold,
      });

      await MockApi.saveSocialRecoveryConfig({
        email: parsed.email || "user@clipcash.ai",
        guardians: validGuardians.map((g) => g.email),
        shares,
        threshold,
        encryptedBackup,
      });

      setSaved(true);
      showToast("Social recovery configuration saved successfully.", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save social recovery configuration.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 border border-white/5 rounded-2xl p-5 bg-black/30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">Social Recovery Configuration</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Set up trusted guardians who can help you recover your wallet in an emergency.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/20 flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-normal">{error}</p>
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 flex gap-2 items-start">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-300 leading-normal">
            Social recovery configuration saved. Your encrypted backup has been split among your guardians.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand" /> Trusted Guardians
          </label>

          {guardians.map((guardian, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Guardian name"
                value={guardian.name}
                onChange={(e) => updateGuardian(i, "name", e.target.value)}
                className="flex-1 bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              />
              <input
                type="email"
                placeholder="Guardian email"
                value={guardian.email}
                onChange={(e) => updateGuardian(i, "email", e.target.value)}
                className="flex-[1.5] bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              />
              <button
                type="button"
                onClick={() => removeGuardian(i)}
                disabled={guardians.length <= 1}
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-muted-foreground hover:text-red-400 hover:border-red-500/25 transition-colors cursor-pointer disabled:opacity-30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addGuardian}
            disabled={guardians.length >= 6}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-muted-foreground hover:text-brand hover:border-brand/25 transition-colors text-[10px] font-bold cursor-pointer disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
            Add Guardian
          </button>
        </div>

        {guardians.length >= 2 && (
          <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Recovery Threshold
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: guardians.length }, (_, i) => i + 2).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThreshold(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    threshold === t
                      ? "bg-brand text-black"
                      : "bg-white/5 text-muted-foreground hover:text-white"
                  }`}
                >
                  {t} of {guardians.length}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">
              You will need approval from {threshold} out of {guardians.length} guardians to recover your wallet.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Recovery Password
          </label>
          <input
            type="password"
            placeholder="Choose a strong password to encrypt your backup"
            value={recoveryPassword}
            onChange={(e) => setRecoveryPassword(e.target.value)}
            className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
          />
          <p className="text-[9px] text-muted-foreground">
            This password encrypts your wallet backup. You will need it when recovering through guardians.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving Configuration...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Save Social Recovery Setup
            </>
          )}
        </button>
      </form>
    </div>
  );
}
