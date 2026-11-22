"use client";

import React, { useState } from "react";
import { useAuth, type User } from "@/components/AuthProvider";
import apiClient from "@/lib/apiClient";
import { signAuthMessage, ensureHexSignature } from "@/lib/wallet";
import { markStepUpVerified } from "@/lib/stepUpAuth";
import Button from "@/components/shared/Button";
import FieldError from "@/components/shared/FieldError";

interface StepUpModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * Re-verifies the user's credentials before a sensitive wallet operation.
 * Email users re-enter their password (checked against /auths/signin);
 * wallet-only users sign a fresh server-issued challenge.
 */
export default function StepUpModal({ isOpen, user, onClose, onVerified }: StepUpModalProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasPassword = Boolean(user?.email);

  if (!isOpen) return null;

  const verifyWithPassword = async () => {
    if (!user?.email || !password) {
      setError("Password is required.");
      return;
    }
    await apiClient.post("/auths/signin", { email: user.email, password });
  };

  const verifyWithWallet = async () => {
    const challengeRes = await apiClient.post("/auths/wallet/challenge", {
      stellarAddress: user?.stellarAddress,
    });
    const { challenge } = challengeRes.data;
    if (!challenge) throw new Error("Failed to get a step-up challenge.");
    const rawSignature = await signAuthMessage(challenge);
    const signature = ensureHexSignature(rawSignature);
    await apiClient.post("/auths/wallet/signin", {
      stellarAddress: user?.stellarAddress,
      message: challenge,
      signature,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (hasPassword) await verifyWithPassword();
      else await verifyWithWallet();
      markStepUpVerified();
      setPassword("");
      onVerified();
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-[400px] bg-[#06351C] border border-[#0e4d2a] rounded-[20px] p-6 shadow-[0_4px_40px_rgba(0,0,0,0.6)]">
        <h3 className="text-[20px] font-extrabold text-[#F4F7EF] mb-1">Verify it&apos;s you</h3>
        <p className="text-[#90A89C] text-[13px] mb-5">
          This wallet operation requires a recent verification (valid for 5 minutes).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword ? (
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="current-password"
              className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] focus:border-[#39FF14]/70 rounded-[12px] px-4 py-3 text-[14px] focus:outline-none placeholder-[#90A89C]/50"
            />
          ) : (
            <p className="text-[13px] text-[#90A89C]">
              You&apos;ll be asked to sign a verification message in your wallet.
            </p>
          )}
          <FieldError message={error} />
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Verify
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
