"use client";

import { AlertCircle, Copy, KeyRound, Loader2, Unlock } from "lucide-react";
import React, { useState } from "react";

import { safeErrorMessage } from "@/app/lib/errorMessages";
import { decryptShareForGuardian, generateGuardianKeyPair } from "@/app/lib/guardianCrypto";

type GuardianShareToolProps = {
  /** Prefilled from the guardian's approval link. */
  initialSessionId?: string;
  initialGuardianEmail?: string;
};

const inputClass =
  "w-full bg-[#111613] border border-white/5 text-white focus:border-brand/40 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors";

/**
 * Guardian-side helper for social recovery.
 *
 * - "Generate key pair": creates the public key the account owner enters in
 *   their recovery config, and the private key the guardian keeps.
 * - "Decrypt my share": fetches the guardian's encrypted share for an active
 *   recovery session and decrypts it locally with the guardian's private key,
 *   so the guardian can send the plaintext share to the account owner.
 *
 * All cryptography runs in the browser; the private key never leaves the device.
 */
export function GuardianShareTool({
  initialSessionId = "",
  initialGuardianEmail = "",
}: GuardianShareToolProps) {
  const [publicKey, setPublicKey] = useState("");
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState("");
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [guardianEmail, setGuardianEmail] = useState(initialGuardianEmail);
  const [privateKey, setPrivateKey] = useState("");
  const [share, setShare] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    try {
      const pair = await generateGuardianKeyPair();
      setPublicKey(pair.publicKey);
      setGeneratedPrivateKey(pair.privateKey);
    } catch (err: unknown) {
      setError(safeErrorMessage(err, "Could not generate a key pair.", "generate guardian key"));
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShare("");
    setBusy(true);
    try {
      const params = new URLSearchParams({ sessionId, guardianEmail });
      const res = await fetch(`/api/recovery/share?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load your share.");
      setShare(await decryptShareForGuardian(body.encryptedShare, privateKey));
    } catch (err: unknown) {
      setError(
        safeErrorMessage(
          err,
          "Could not decrypt the share. Check that you used the private key for this account.",
          "decrypt guardian share"
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/20 flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-normal">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-brand" /> Become a guardian
        </p>
        <p className="text-[10px] text-muted-foreground leading-normal">
          Generate a key pair and send the public key to the person who asked you to be their
          guardian. Store the private key somewhere safe — you need it to release your share.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-white hover:border-brand/25 transition-colors text-[11px] font-bold cursor-pointer"
        >
          Generate key pair
        </button>
        {publicKey && (
          <div className="space-y-2">
            <label className="block text-[10px] text-muted-foreground">
              Public key (share this)
              <textarea readOnly rows={2} value={publicKey} className={`${inputClass} font-mono mt-1`} />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Private key (keep secret)
              <textarea
                readOnly
                rows={3}
                value={generatedPrivateKey}
                className={`${inputClass} font-mono mt-1`}
              />
            </label>
          </div>
        )}
      </div>

      <form onSubmit={handleDecrypt} className="space-y-2 pt-4 border-t border-white/5">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Unlock className="w-3.5 h-3.5 text-brand" /> Release your share
        </p>
        <input
          aria-label="Recovery session ID"
          placeholder="Recovery session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className={inputClass}
        />
        <input
          type="email"
          aria-label="Your guardian email"
          placeholder="Your guardian email"
          value={guardianEmail}
          onChange={(e) => setGuardianEmail(e.target.value)}
          className={inputClass}
        />
        <textarea
          aria-label="Your guardian private key"
          placeholder="Your guardian private key"
          rows={3}
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          className={`${inputClass} font-mono`}
        />
        <button
          type="submit"
          disabled={busy || !sessionId || !guardianEmail || !privateKey}
          className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Decrypt my share
        </button>
        {share && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">
              Send this share to the account owner over a channel you trust.
            </p>
            <div className="flex gap-2">
              <textarea readOnly rows={3} value={share} className={`${inputClass} font-mono`} />
              <button
                type="button"
                onClick={() => copy(share)}
                aria-label="Copy share"
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-muted-foreground hover:text-brand cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
