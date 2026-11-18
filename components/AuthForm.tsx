"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useRouter } from "next/navigation";
import { z } from "zod";
import apiClient from "@/lib/apiClient";
import WalletButton from "@/components/shared/WalletButton";
import { signAuthMessage, ensureHexSignature } from "@/lib/wallet";
import EmailVerificationModal from "@/components/auth/EmailVerificationModal";
import { getFriendlyErrorMessage } from "@/lib/formatError";

const emailAuthSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
});

interface AuthFormProps {
  mode?: "login" | "signup";
  showWallet?: boolean;
}

export default function AuthForm({ mode = "login", showWallet = true }: AuthFormProps) {
  const { setUser } = useAuth();
  const router = useRouter();

  const currentMode = mode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [isUnverified, setIsUnverified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const shakeCard = () => {
    const card = document.getElementById("auth-card");
    if (card) {
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
    }
  };

  const handleWalletConnect = async (address: string) => {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      setInfo("Generating challenge...");
      const challengeRes = await apiClient.post("/auths/wallet/challenge", {
        stellarAddress: address,
      });
      const { challenge } = challengeRes.data;

      if (!challenge) {
        throw new Error("Failed to get a valid challenge from the server.");
      }

      setInfo("Please sign the message in your wallet...");
      const rawSignature = await signAuthMessage(challenge);
      const signature = ensureHexSignature(rawSignature);

      setInfo("Verifying credentials...");
      let authRes;

      if (currentMode === "signup") {
        try {
          authRes = await apiClient.post("/auths/wallet/signup", {
            stellarAddress: address,
            message: challenge,
            signature,
          });
        } catch (signupErr: any) {
          if (
            signupErr.response?.status === 400 &&
            signupErr.response?.data?.message?.toLowerCase().includes("already registered")
          ) {
            authRes = await apiClient.post("/auths/wallet/signin", {
              stellarAddress: address,
              message: challenge,
              signature,
            });
          } else {
            throw signupErr;
          }
        }
      } else {
        authRes = await apiClient.post("/auths/wallet/signin", {
          stellarAddress: address,
          message: challenge,
          signature,
        });
      }

      const { user } = authRes.data;
      if (user) {
        setUser(user);
        router.push(currentMode === "signup" ? "/onboarding" : "/dashboard");
      } else {
        throw new Error("Authentication response did not contain user data.");
      }
    } catch (err: any) {
      console.error("[AuthForm] Wallet Auth Error:", err);
      const message = getFriendlyErrorMessage(err, "Wallet authentication failed.");
      setError(message);
      shakeCard();
    } finally {
      setLoading(false);
      setInfo("");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const validation = emailAuthSchema.safeParse({
      email,
      password,
      fullName: currentMode === "signup" ? fullName : undefined,
    });

    if (!validation.success) {
      setError(validation.error.issues?.[0]?.message || (validation.error as any).errors?.[0]?.message || "Validation failed");
      shakeCard();
      return;
    }

    setLoading(true);

    try {
      if (currentMode === "signup") {
        const trimmedEmail = email.trim().toLowerCase();
        await apiClient.post("/auths/send-otp", { email: trimmedEmail });
        setPendingVerificationEmail(trimmedEmail);
        setShowVerificationModal(true);
      } else {
        const response = await apiClient.post("/auths/signin", {
          email: email.trim().toLowerCase(),
          password,
        });

        const { user } = response.data;
        if (user) {
          setUser(user);
          router.push("/dashboard");
        } else {
          throw new Error("Login succeeded but no user data was returned.");
        }
      }
    } catch (err: any) {
      console.error("[AuthForm] Email Auth Error:", err);
      if (err.response?.status === 403) {
        const rawMsg = err.response?.data?.message;
        const msgStr = Array.isArray(rawMsg) ? rawMsg[0] : rawMsg;
        if (msgStr && msgStr.toLowerCase().includes("not verified")) {
          setError("Your email address is not verified yet.");
          setIsUnverified(true);
          setPendingVerificationEmail(email.trim().toLowerCase());
          shakeCard();
          return;
        }
      }
      const message = getFriendlyErrorMessage(err, "Authentication failed. Please try again.");
      setError(message);
      shakeCard();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-card"
      className="w-full max-w-[440px] mx-auto bg-[#06351C]/95 backdrop-blur-md rounded-[24px] p-6 sm:p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.6)] border border-[#0e4d2a] relative overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#39FF14]/10 rounded-full blur-[70px] pointer-events-none" />

      <h2 className="text-[24px] sm:text-[28px] text-[#F4F7EF] font-extrabold tracking-tight mb-1">
        {currentMode === "login" ? "Welcome back" : "Create an account"}
      </h2>
      <p className="text-[#90A89C] mb-6 sm:mb-8 text-[14px] sm:text-[15px]">
        {currentMode === "login"
          ? "Log in to start creating viral content"
          : "Sign up to start creating viral content"}
      </p>

      {showWallet && (
        <>
          <div className="mb-6 sm:mb-8">
            <WalletButton
              onConnect={handleWalletConnect}
              className="w-full flex items-center justify-center gap-3 bg-[#042413] hover:bg-[#084223] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#B6FF4A] py-3.5 rounded-[14px] font-bold transition-all text-[14px]"
            />
          </div>

          <div className="flex items-center gap-4 text-[#90A89C] text-[11px] font-bold tracking-[0.1em] uppercase mb-6 sm:mb-8">
            <div className="flex-1 h-px bg-[#0e4d2a]" />
            OR EMAIL
            <div className="flex-1 h-px bg-[#0e4d2a]" />
          </div>
        </>
      )}

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        {currentMode === "signup" && (
          <div>
            <label className="block text-[13px] font-bold text-[#90A89C] mb-2 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] focus:border-[#39FF14]/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#06351C] transition-colors placeholder-[#90A89C]/50"
            />
          </div>
        )}
        <div>
          <label className="block text-[13px] font-bold text-[#90A89C] mb-2 uppercase tracking-wider">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
              setIsUnverified(false);
            }}
            placeholder="name@company.com"
            className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] focus:border-[#39FF14]/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-[#06351C] transition-colors placeholder-[#90A89C]/50"
          />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-[#90A89C] mb-2 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
                setIsUnverified(false);
              }}
              placeholder="••••••••"
              className="w-full bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] focus:border-[#39FF14]/70 rounded-[12px] pl-4 pr-11 py-3.5 text-[14px] focus:outline-none focus:bg-[#06351C] transition-colors placeholder-[#90A89C]/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90A89C] hover:text-[#F4F7EF] transition-colors p-1"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="space-y-2 pt-1 text-center">
            <div className="text-[13px] text-red-400">
              {error}
            </div>
            {isUnverified && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetEmail = pendingVerificationEmail || email.trim().toLowerCase();
                    setPendingVerificationEmail(targetEmail);
                    setShowVerificationModal(true);
                  }}
                  className="text-[12.5px] text-[#B6FF4A] hover:underline font-semibold inline-flex items-center gap-1.5 bg-[#B6FF4A]/10 hover:bg-[#B6FF4A]/15 px-3 py-1.5 rounded-lg border border-[#B6FF4A]/25 transition-all"
                >
                  <span>Enter verification code or resend OTP</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        )}

        {info && (
          <div className="text-[13px] text-center pt-1 text-[#B6FF4A]">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] py-[15px] rounded-[14px] font-black text-[15px] flex justify-center items-center gap-2 transition-all disabled:opacity-70 mt-[6px] shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#020D08]" />
          ) : currentMode === "login" ? (
            "Continue with Email"
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div className="text-center mt-7 text-[13px] text-[#90A89C]">
        {currentMode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[#B6FF4A] font-bold hover:underline"
            >
              Get Started
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/"
              className="text-[#B6FF4A] font-bold hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      <EmailVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        email={pendingVerificationEmail}
        signupPayload={
          currentMode === "signup" && fullName && password
            ? { fullName: fullName.trim(), password }
            : undefined
        }
        onChangeEmail={() => {
          setShowVerificationModal(false);
          const emailInput = document.getElementById("auth-email");
          if (emailInput) {
            emailInput.focus();
          }
        }}
        onVerified={() => {
          setShowVerificationModal(false);
          router.push("/onboarding");
        }}
      />
    </div>
  );
}
