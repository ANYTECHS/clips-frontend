"use client";

import React, { useState } from "react";
import { MockApi } from "../lib/mockApi";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await MockApi.requestPasswordReset(email);
      setMessage("If an account with that email exists, you will receive a password reset link.");
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        setMessage("If an account with that email exists, you will receive a password reset link.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/80 backdrop-blur-md rounded-[20px] p-8 shadow-lg border border-border">
        <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
        <p className="text-muted text-sm mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {message ? (
          <div className="text-center">
            <div className="text-green-400 text-sm mb-6">{message}</div>
            <button
              onClick={() => router.push("/login")}
              className="text-brand hover:underline text-sm"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-[#8e9895] mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-surface-hover transition-colors"
              />
            </div>

            {error && <div className="text-error text-[13px] text-center">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center disabled:opacity-70"
            >
              {loading ? "Sending..." : "Send Reset Link"}
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
