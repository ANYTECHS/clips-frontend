"use client";

import React, { useState, useEffect } from "react";
import { MockApi } from "../lib/mockApi";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCountdown(remaining > 0 ? `${remaining}s` : "");
      if (remaining <= 0) setCooldownUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ resetAt: number }>;
      setCooldownUntil(custom.detail.resetAt);
    };
    window.addEventListener("rate-limit-exceeded", handler as EventListener);
    return () => window.removeEventListener("rate-limit-exceeded", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (cooldownUntil && Date.now() < cooldownUntil) {
      setError(`Too many attempts. Please wait ${countdown} before trying again.`);
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await MockApi.resetPassword(token!, password);
      setMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'RATE_LIMIT_EXCEEDED') {
          setError(countdown ? `Too many attempts. Please wait ${countdown} before trying again.` : "Too many requests. Please wait a moment and try again.");
        } else if (err.message === 'Invalid or expired token') {
          setError("This reset link is invalid or has expired. Please request a new one.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/80 backdrop-blur-md rounded-[20px] p-8 shadow-lg border border-border">
        <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-muted text-sm mb-6">
          Enter your new password below.
        </p>

        {message ? (
          <div className="text-center">
            <div className="text-green-400 text-sm mb-6">{message}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-[#8e9895] mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:bg-surface-hover transition-colors"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-[#8e9895] mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:bg-surface-hover transition-colors"
              />
            </div>

            {error && <div className="text-error text-[13px] text-center">{error}</div>}

            <button
              type="submit"
              disabled={loading || !token || (cooldownUntil !== null && Date.now() < cooldownUntil)}
              className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center disabled:opacity-70"
            >
              {loading ? "Resetting..." : countdown ? `Wait ${countdown}` : "Reset Password"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-brand hover:underline text-sm"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
