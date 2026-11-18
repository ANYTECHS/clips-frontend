"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowRight, RefreshCw } from "lucide-react";
import LandingLayout from "@/components/shared/LandingLayout";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { getFriendlyErrorMessage } from "@/lib/formatError";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();

  const emailParam = searchParams.get("email") || "";
  const otpParam = searchParams.get("otp") || searchParams.get("token") || "";

  const [emailInput, setEmailInput] = useState(emailParam);
  const [tokenInput, setTokenInput] = useState(otpParam);
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "idle">(
    emailParam && otpParam ? "verifying" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const verifyOtp = useCallback(async (targetEmail: string, code: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const cleanOtp = code.trim();
    if (!cleanEmail) {
      setStatus("error");
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!cleanOtp) {
      setStatus("error");
      setErrorMessage("Please enter your 6-digit verification code.");
      return;
    }

    setStatus("verifying");
    setErrorMessage("");

    try {
      await apiClient.post("/auths/verify-email", {
        email: cleanEmail,
        otp: cleanOtp,
      });
      
      try {
        const { data: user } = await apiClient.get("/users/me");
        setUser(user, true);
      } catch {
        // If profile fetch fails, still consider verification valid
      }

      setStatus("success");
      setTimeout(() => {
        router.push("/onboarding");
      }, 2000);
    } catch (err: any) {
      console.error("Verification failed:", err);
      setStatus("error");
      setErrorMessage(getFriendlyErrorMessage(err, "Invalid or expired verification code. Please request a new one."));
    }
  }, [router, setUser]);

  useEffect(() => {
    if (emailParam && otpParam) {
      verifyOtp(emailParam, otpParam);
    }
  }, [emailParam, otpParam, verifyOtp]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtp(emailInput || resendEmail, tokenInput);
  };

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = (resendEmail || emailInput).trim().toLowerCase();
    if (!cleanEmail) return;

    setResending(true);
    setResendSuccess("");
    setErrorMessage("");

    try {
      await apiClient.post("/auths/resend-verification", { email: cleanEmail });
      setResendSuccess("A new verification email has been sent to your inbox!");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err, "Could not resend verification email. Please try again."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] mx-auto bg-[#06351C] rounded-[24px] p-7 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(57,255,20,0.06)] border border-[#0e4d2a] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#39FF14]/10 rounded-full blur-[60px] pointer-events-none" />

      {status === "verifying" && (
        <div className="flex flex-col items-center text-center space-y-5 py-4">
          <div className="w-14 h-14 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-[#F4F7EF] tracking-tight">Verifying your email</h2>
            <p className="text-[#90A89C] text-[14px]">
              Please wait while we verify your account credentials...
            </p>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center text-center space-y-5 py-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-[#042413] border border-[#39FF14]/40 flex items-center justify-center text-[#B6FF4A] shadow-[0_0_30px_rgba(57,255,20,0.25)]">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-[#F4F7EF] tracking-tight">Email Verified!</h2>
            <p className="text-[#90A89C] text-[14px]">
              Your account has been successfully verified. Welcome to enclips!
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding")}
            className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-3.5 rounded-[12px] font-black text-[14px] flex items-center justify-center gap-2 transition-all mt-4 shadow-[0_0_20px_rgba(57,255,20,0.25)]"
          >
            <span>Continue to Onboarding</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[22px] font-bold text-[#F4F7EF] tracking-tight">Verification Failed</h2>
              <p className="text-red-400 text-[13px] leading-relaxed">
                {errorMessage || "The verification link is invalid or has expired."}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-[#90A89C] uppercase tracking-wider mb-1.5">
                Your Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setResendEmail(e.target.value);
                }}
                placeholder="name@example.com"
                className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] rounded-[12px] px-4 py-3 text-[14px] focus:outline-none focus:border-[#39FF14]/70 placeholder-[#90A89C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#90A89C] uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={10}
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="205283"
                className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] rounded-[12px] px-4 py-3 text-[18px] text-center focus:outline-none focus:border-[#39FF14]/70 font-mono tracking-[0.2em] placeholder:tracking-normal placeholder-[#90A89C]"
              />
            </div>

            <button
              type="submit"
              disabled={!tokenInput.trim() || !emailInput.trim()}
              className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-3.5 rounded-[12px] font-black text-[14px] disabled:opacity-40 transition-colors shadow-[0_0_20px_rgba(57,255,20,0.25)]"
            >
              Verify Code
            </button>
          </form>

          {/* Resend link */}
          <div className="text-center pt-1 space-y-2">
            {resendSuccess && (
              <p className="text-[12px] text-[#B6FF4A] font-medium">{resendSuccess}</p>
            )}
            <div className="flex items-center justify-center gap-1.5 text-[13px]">
              <span className="text-[#90A89C]">Didn&apos;t receive it?</span>
              <button
                type="button"
                onClick={() => handleResend()}
                disabled={resending || resendCooldown > 0}
                className="text-[#B6FF4A] hover:underline font-bold inline-flex items-center gap-1 disabled:opacity-50"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend email</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center pt-1">
            <Link href="/login" className="text-[#90A89C] hover:text-[#B6FF4A] text-[13px] font-medium transition-colors">
              ← Return to Login
            </Link>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A] shadow-[0_0_20px_rgba(57,255,20,0.15)]">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-[22px] font-bold text-[#F4F7EF] tracking-tight">Email Verification</h2>
              <p className="text-[#90A89C] text-[13.5px]">
                Enter your email and the 6-digit code sent to your inbox.
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-[#90A89C] uppercase tracking-wider mb-1.5">
                Your Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setResendEmail(e.target.value);
                }}
                placeholder="name@example.com"
                className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] rounded-[12px] px-4 py-3 text-[14px] focus:outline-none focus:border-[#39FF14]/70 placeholder-[#90A89C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#90A89C] uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={10}
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="205283"
                className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] rounded-[12px] px-4 py-3 text-[18px] text-center focus:outline-none focus:border-[#39FF14]/70 font-mono tracking-[0.2em] placeholder:tracking-normal placeholder-[#90A89C]"
              />
            </div>

            <button
              type="submit"
              disabled={!tokenInput.trim() || !emailInput.trim()}
              className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-3.5 rounded-[12px] font-black text-[14px] disabled:opacity-40 transition-colors shadow-[0_0_20px_rgba(57,255,20,0.25)]"
            >
              Verify Code
            </button>
          </form>

          {/* Resend link */}
          <div className="text-center pt-1 space-y-2">
            {resendSuccess && (
              <p className="text-[12px] text-[#B6FF4A] font-medium">{resendSuccess}</p>
            )}
            <div className="flex items-center justify-center gap-1.5 text-[13px]">
              <span className="text-[#90A89C]">Didn&apos;t receive it?</span>
              <button
                type="button"
                onClick={() => handleResend()}
                disabled={resending || resendCooldown > 0}
                className="text-[#B6FF4A] hover:underline font-bold inline-flex items-center gap-1 disabled:opacity-50"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend email</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center pt-1">
            <Link href="/login" className="text-[#90A89C] hover:text-[#B6FF4A] text-[13px] font-medium transition-colors">
              ← Back to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <LandingLayout>
      <div className="w-full flex justify-center items-center py-12 px-4">
        <Suspense
          fallback={
            <div className="w-full max-w-[440px] bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-12 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#B6FF4A]" />
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </LandingLayout>
  );
}
