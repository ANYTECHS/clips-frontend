"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  ArrowRight,
  Edit3,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/formatError";

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  signupPayload?: {
    fullName: string;
    password: string;
  };
  onVerified?: () => void;
  onChangeEmail?: () => void;
}

export default function EmailVerificationModal({
  isOpen,
  onClose,
  email,
  signupPayload,
  onVerified,
  onChangeEmail,
}: EmailVerificationModalProps) {
  const { setUser } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [inputEmail, setInputEmail] = useState(email || "");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (email) setInputEmail(email);
  }, [email]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setError("");
      setResendStatus("");
      setVerifiedSuccess(false);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !verifying) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, verifying, onClose]);

  const handleSuccess = useCallback(
    (userData: any) => {
      setVerifiedSuccess(true);
      if (userData) setUser(userData);
      setTimeout(() => {
        onVerified?.();
        router.push("/onboarding");
      }, 1600);
    },
    [setUser, onVerified, router]
  );

  const executeVerify = useCallback(
    async (codeToVerify: string) => {
      const cleanToken = codeToVerify.trim();
      if (cleanToken.length < 4) {
        setError("Please enter the complete verification code.");
        return;
      }

      setVerifying(true);
      setError("");
      setResendStatus("");

      try {
        let response;
        const targetEmail = (inputEmail || email).trim().toLowerCase();

        if (signupPayload) {
          response = await apiClient.post("/auths/verify-otp", {
            email: targetEmail,
            otp: cleanToken,
            password: signupPayload.password,
            fullName: signupPayload.fullName,
          });
        } else {
          response = await apiClient.post("/auths/verify-email", {
            token: cleanToken,
            email: targetEmail || undefined,
          });
        }

        const { user } = response.data;
        handleSuccess(user);
      } catch (err: any) {
        console.error("[EmailVerificationModal] Verification error:", err);
        setError(getFriendlyErrorMessage(err, "Invalid or expired verification code. Please check and try again."));
      } finally {
        setVerifying(false);
      }
    },
    [email, inputEmail, signupPayload, handleSuccess]
  );

  const handleDigitChange = (index: number, val: string) => {
    setError("");

    // If pasted multiple digits into one field
    if (val.length > 1) {
      const cleanDigits = val.replace(/\D/g, "").slice(0, 6).split("");
      const newDigits = [...digits];
      cleanDigits.forEach((d, i) => {
        newDigits[i] = d;
      });
      setDigits(newDigits);

      const nextFocus = Math.min(cleanDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (cleanDigits.length === 6) {
        executeVerify(cleanDigits.join(""));
      }
      return;
    }

    const digit = val.replace(/\D/g, "");
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join("");
    if (fullCode.length === 6) {
      executeVerify(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = ["", "", "", "", "", ""];
    pasted.split("").forEach((d, i) => {
      newDigits[i] = d;
    });
    setDigits(newDigits);

    const nextFocus = Math.min(pasted.length, 5);
    inputRefs.current[nextFocus]?.focus();

    if (pasted.length === 6) {
      executeVerify(pasted);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerify(digits.join(""));
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setResendStatus("");

    const target = (inputEmail || email).trim().toLowerCase();
    if (!target) {
      setError("Please enter your email address to resend the code.");
      setResending(false);
      return;
    }

    try {
      if (signupPayload) {
        await apiClient.post("/auths/send-otp", { email: target });
      } else {
        await apiClient.post("/auths/resend-verification", { email: target });
      }
      setResendStatus("New code sent! Check your inbox.");
      setResendCooldown(60);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message || err.message;
      const msg = Array.isArray(backendMessage) ? backendMessage[0] : backendMessage;
      if (err.response?.status === 400 && msg?.toLowerCase().includes("already verified")) {
        setResendStatus("This email is already verified! You can proceed to log in.");
        setTimeout(() => {
          router.push("/login");
          onClose();
        }, 1500);
      } else {
        setError(getFriendlyErrorMessage(err, "Could not resend verification email. Please try again."));
      }
    } finally {
      setResending(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const currentEmail = email || inputEmail;
  const isCodeComplete = digits.every((d) => d.length === 1);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Full screen backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={!verifying ? onClose : undefined}
      />

      {/* Clean Modal Card (Portaled directly to document.body, free of parent card constraints) */}
      <div className="relative w-full max-w-[420px] bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(57,255,20,0.08)] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#39FF14]/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          disabled={verifying}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#042413] hover:bg-[#084223] flex items-center justify-center text-[#90A89C] hover:text-[#F4F7EF] transition-colors border border-[#0e4d2a] disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        {verifiedSuccess ? (
          <div className="flex flex-col items-center text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-[#042413] border border-[#39FF14]/40 flex items-center justify-center text-[#B6FF4A] shadow-[0_0_25px_rgba(57,255,20,0.25)] animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-[#F4F7EF] tracking-tight">
                Email Verified!
              </h3>
              <p className="text-[#90A89C] text-[14px]">
                Your account is ready. Redirecting you to onboarding...
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-[#B6FF4A] text-[13px] font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Setting up your workspace...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Header: Clean & uncluttered */}
            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#B6FF4A] shadow-[0_0_20px_rgba(57,255,20,0.15)]">
                <Mail className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-[22px] font-extrabold text-[#F4F7EF] tracking-tight">
                  Verify your email
                </h3>
                <p className="text-[#90A89C] text-[13.5px] leading-relaxed">
                  Enter the 6-digit code sent to
                </p>
                {currentEmail && (
                  <div className="inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#B6FF4A]">
                    <span className="truncate max-w-[260px]">{currentEmail}</span>
                    {onChangeEmail && (
                      <button
                        onClick={() => {
                          onClose();
                          onChangeEmail();
                        }}
                        type="button"
                        title="Change email"
                        className="text-[#90A89C] hover:text-[#F4F7EF] transition-colors p-0.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error & Success notifications */}
            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12.5px] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 leading-snug">{error}</span>
              </div>
            )}

            {resendStatus && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 text-[#B6FF4A] text-[12.5px] flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 leading-snug">{resendStatus}</span>
              </div>
            )}

            {/* 6-Digit OTP Input Form */}
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    disabled={verifying}
                    className={`w-11 sm:w-12 h-14 rounded-xl bg-[#042413] border text-center text-[22px] font-black text-[#F4F7EF] font-mono outline-none transition-all ${
                      digit
                        ? "border-[#39FF14] shadow-[0_0_12px_rgba(57,255,20,0.2)]"
                        : "border-[#0e4d2a] focus:border-[#39FF14]/80 focus:shadow-[0_0_10px_rgba(57,255,20,0.15)]"
                    }`}
                  />
                ))}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={verifying || !isCodeComplete}
                className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-3.5 rounded-xl font-black text-[14px] flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)] active:scale-[0.99]"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#020D08]" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Clean Footer Row */}
            <div className="text-center space-y-2 pt-1">
              <div className="flex items-center justify-center gap-1.5 text-[13px]">
                <span className="text-[#90A89C]">Didn&apos;t receive it?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="text-[#B6FF4A] hover:underline font-bold inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline transition-opacity cursor-pointer"
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
                      <span>Resend code</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11.5px] text-[#90A89C]/80 leading-normal">
                Check your spam folder if the email takes more than a minute.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
