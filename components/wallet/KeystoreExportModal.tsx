"use client";

import React, { useState } from "react";
import { KeyRound, Download, ShieldCheck, AlertTriangle, Eye, EyeOff, X, Loader2 } from "lucide-react";
import { encryptWithPassword } from "@/app/lib/cryptoUtils";

interface KeystoreExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey?: string;
  secretKey?: string;
  mnemonic?: string;
}

export default function KeystoreExportModal({
  isOpen,
  onClose,
  publicKey = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWGS",
  secretKey,
  mnemonic,
}: KeystoreExportModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const payloadToEncrypt = JSON.stringify({
        publicKey,
        secretKey: secretKey ?? "S...REDACTED_MOCK_SECRET_KEY",
        mnemonic: mnemonic ?? undefined,
        exportedAt: new Date().toISOString(),
      });

      const encryptedCiphertext = await encryptWithPassword(payloadToEncrypt, password);

      const keystore = {
        version: 1,
        address: publicKey,
        crypto: {
          ciphertext: encryptedCiphertext,
          cipher: "AES-256-GCM",
          kdf: "PBKDF2",
          kdfparams: {
            iterations: 100000,
            hash: "SHA-256",
          },
        },
        meta: {
          app: "ClipCash",
          createdAt: new Date().toISOString(),
        },
      };

      const blob = new Blob([JSON.stringify(keystore, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clipcash-keystore-${publicKey.slice(0, 6)}...${publicKey.slice(-4)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError("Failed to encrypt and export keystore.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-brand/10 border border-brand/20 text-brand rounded-xl">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export Encrypted Keystore</h3>
            <p className="text-xs text-muted-foreground">Secure password-protected backup file</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Never lose this password. If lost, your keystore cannot be decrypted.</span>
        </div>

        <form onSubmit={handleExport} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Wallet Address
            </label>
            <input
              type="text"
              readOnly
              value={publicKey}
              className="w-full bg-input rounded-xl px-3 py-2 text-xs font-mono text-white/60 border border-white/10 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Keystore Encryption Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password (min 8 chars)"
                className="w-full bg-input rounded-xl px-3 py-2.5 pr-10 text-xs text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-input rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:border-brand"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 font-medium">{error}</p>
          )}

          {downloadSuccess && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Keystore file downloaded successfully!
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-white/70 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-black rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
