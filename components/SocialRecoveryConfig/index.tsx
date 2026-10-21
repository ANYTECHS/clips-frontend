"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import React, { useState } from "react";

import { encryptWithPassword } from "@/app/lib/cryptoUtils";
import { FAILURE_MESSAGES, safeErrorMessage, VALIDATION_MESSAGES } from "@/app/lib/errorMessages";
import { encryptShareForGuardian, isValidGuardianPublicKey } from "@/app/lib/guardianCrypto";
import { secureStorage } from "@/app/lib/secureStorage";
import { defaultRecoveryThreshold, splitSecret } from "@/app/lib/shamirRecovery";
import { useToast } from "@/hooks/useToast";

export { decryptWithPassword,encryptWithPassword } from "@/app/lib/cryptoUtils";

const MIN_SHARES = 2;
const MAX_SHARES = 6;

type Guardian = { email: string; name: string; publicKey: string };

const emptyGuardian = (): Guardian => ({ email: "", name: "", publicKey: "" });

export default function SocialRecoveryConfig() {
  const { showToast } = useToast();
  const [guardians, setGuardians] = useState<Guardian[]>([emptyGuardian(), emptyGuardian()]);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const totalShares = guardians.length;

  /** Each guardian receives exactly one share, so total shares sizes the guardian list. */
  const setTotalShares = (count: number) => {
    const next = Math.min(MAX_SHARES, Math.max(MIN_SHARES, count));
    setGuardians((prev) =>
      next > prev.length
        ? [...prev, ...Array.from({ length: next - prev.length }, emptyGuardian)]
        : prev.slice(0, next)
    );
    if (threshold > next) setThreshold(next);
  };

  const addGuardian = () => setTotalShares(totalShares + 1);

  const removeGuardian = (index: number) => {
    if (guardians.length <= MIN_SHARES) return;
    const updated = guardians.filter((_, i) => i !== index);
    setGuardians(updated);
    if (threshold > updated.length) {
      setThreshold(Math.max(MIN_SHARES, updated.length));
    }
  };

  const updateGuardian = (index: number, field: keyof Guardian, value: string) => {
    const updated = [...guardians];
    updated[index] = { ...updated[index], [field]: value };
    setGuardians(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (guardians.some((g) => !g.email.trim())) {
      setError(VALIDATION_MESSAGES.guardiansRequired);
      return;
    }
    const emails = guardians.map((g) => g.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      setError("Each guardian must have a different email address.");
      return;
    }
    for (const g of guardians) {
      if (!(await isValidGuardianPublicKey(g.publicKey))) {
        setError(`Enter a valid guardian public key for ${g.name || g.email}.`);
        return;
      }
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

      // Password-encrypt first so the recombined secret is still useless
      // without the owner's recovery password.
      const encryptedBackup = await encryptWithPassword(backupPayload, recoveryPassword);
      const shares = splitSecret(encryptedBackup, totalShares, threshold);

      // Encrypt each share to its guardian's public key client-side; the
      // server only ever receives ciphertext.
      const encryptedShares = await Promise.all(
        shares.map((share, i) => encryptShareForGuardian(share, guardians[i].publicKey.trim()))
      );

      for (let i = 0; i < guardians.length; i++) {
        const res = await fetch("/api/recovery/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guardianEmail: guardians[i].email.trim(),
            encryptedShare: encryptedShares[i],
            threshold,
            totalShares,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to store guardian share.");
        }
      }

      setSaved(true);
      showToast("Social recovery configuration saved successfully.", "success");
    } catch (err: unknown) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.saveSocialRecovery, "save social recovery"));
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
            Social recovery configuration saved. Your encrypted backup has been split into{" "}
            {totalShares} shares, each encrypted to its guardian&apos;s public key.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand" /> Trusted Guardians
          </label>

          {guardians.map((guardian, i) => (
            <div key={i} className="space-y-2 p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
              <div className="flex items-center gap-2">
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
                  disabled={guardians.length <= MIN_SHARES}
                  aria-label={`Remove guardian ${i + 1}`}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-muted-foreground hover:text-red-400 hover:border-red-500/25 transition-colors cursor-pointer disabled:opacity-30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Guardian public key (from the guardian key tool on /recovery)"
                aria-label={`Guardian ${i + 1} public key`}
                value={guardian.publicKey}
                onChange={(e) => updateGuardian(i, "publicKey", e.target.value)}
                className="w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-3 py-2.5 text-[10px] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addGuardian}
            disabled={guardians.length >= MAX_SHARES}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-muted-foreground hover:text-brand hover:border-brand/25 transition-colors text-[10px] font-bold cursor-pointer disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
            Add Guardian
          </button>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5 space-y-3">
          <div>
            <label
              htmlFor="total-shares"
              className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2"
            >
              Total Shares
            </label>
            <select
              id="total-shares"
              value={totalShares}
              onChange={(e) => setTotalShares(Number(e.target.value))}
              className="bg-[#111613] border border-white/5 text-white rounded-lg px-3 py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {Array.from({ length: MAX_SHARES - MIN_SHARES + 1 }, (_, i) => i + MIN_SHARES).map(
                (n) => (
                  <option key={n} value={n}>
                    {n} shares
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Recovery Threshold
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recovery threshold">
              {Array.from({ length: totalShares - 1 }, (_, i) => i + 2).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={threshold === t}
                  onClick={() => setThreshold(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    threshold === t
                      ? "bg-brand text-black"
                      : "bg-white/5 text-muted-foreground hover:text-white"
                  }`}
                >
                  {t} of {totalShares}
                  {t === defaultRecoveryThreshold(totalShares) ? " (recommended)" : ""}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Your backup is split into {totalShares} shares, each encrypted to one guardian&apos;s
            public key. Any {threshold} of {totalShares} guardians can help you recover your wallet.
          </p>
        </div>

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
            This password encrypts your wallet backup. You will need it when recovering through
            guardians.
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
