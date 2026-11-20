"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import OnboardingHero from "@/components/onboarding/OnboardingHero";
import ProfileSetupForm from "@/components/onboarding/ProfileSetupForm";
import apiClient from "@/lib/apiClient";
import { Wallet, Loader2 } from "lucide-react";
import { signAuthMessage, StellarWalletsKit, ensureHexSignature } from "@/lib/wallet";
import { getFriendlyErrorMessage } from "@/lib/formatError";
import Button from "@/components/shared/Button";

function OnboardingInner() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Present when the user arrived from the wallet connect flow
  const walletAddress = searchParams.get("wallet");
  // Show the wallet registration form only when ?wallet= is set AND there's no session yet
  const isWalletSignup = !!walletAddress && !user;

  const [loading, setLoading] = useState(false);

  // Normal onboarding state (used after a session exists)
  const [username, setUsername] = useState(user?.profile?.username ?? "");
  const [niche, setNiche] = useState(user?.profile?.niche ?? "");

  // Wallet signup form state
  const [walletError, setWalletError] = useState("");

  // ── Wallet signup: anonymous — no fullName needed, goes straight to dashboard ──

  const handleWalletSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError("");
    setLoading(true);

    try {
      // 0. Ensure we have the correct address from the wallet itself
      const { address: currentAddress } = await StellarWalletsKit.getAddress();
      const signupAddress = currentAddress || walletAddress?.trim();

      if (!signupAddress) {
        throw new Error("No wallet address found. Please connect your wallet.");
      }

      // 1. Get challenge from backend
      const challengeRes = await apiClient.post("/auths/wallet/challenge", {
        stellarAddress: signupAddress,
      });

      const { challenge } = challengeRes.data;

      if (!challenge) {
        throw new Error("Failed to get a valid challenge from the server.");
      }

      // 2. Sign the challenge
      const rawSignature = await signAuthMessage(challenge);
      const signature = ensureHexSignature(rawSignature);

      // 3. Create the account — anonymous, no fullName required
      const { data: signupRes } = await apiClient.post("/auths/wallet/signup", {
        stellarAddress: signupAddress,
        signature,
        message: challenge,
      });

      const newUser = signupRes.user || signupRes;
      if (!newUser || !newUser.id) {
        throw new Error("Signup successful but user data is missing.");
      }

      // Wallet accounts go straight to dashboard
      setUser(newUser);
      router.push(signupRes.redirect ?? "/dashboard");
    } catch (err: any) {
      console.error("Wallet onboarding error:", err);
      setWalletError(getFriendlyErrorMessage(err, "Wallet registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const completeProfileSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      alert("Username must be at least 3 characters");
      return;
    }
    setLoading(true);

    try {
      const { data } = await apiClient.patch("/users/me", { username: cleanUsername });
      setUser({
        ...data,
        username: cleanUsername,
        onboardingStep: 3,
        profile: { ...data.profile, username: cleanUsername, niche },
      });
      router.push("/dashboard");
    } catch {
      setUser({
        ...user,
        username: cleanUsername,
        onboardingStep: 3,
        profile: { ...user.profile, username: cleanUsername, niche },
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[#F4F7EF] font-sans flex flex-col relative overflow-hidden bg-[#020D08]">
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-[#39FF14]/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-[#00C853]/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3" />

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">
        {isWalletSignup && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 mt-[-20px]">
            <OnboardingHero />

            <div className="w-full max-w-[440px] bg-[#06351C] backdrop-blur-md rounded-[20px] p-[38px] border border-[#0e4d2a] shadow-[0_4px_40px_rgba(0,0,0,0.5)]">
              {/* Wallet badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-[#B6FF4A]" />
                </div>
                <div>
                  <p className="text-[#F4F7EF] font-bold text-[15px] leading-tight">Wallet connected</p>
                  <p className="text-[#90A89C] text-[12px] font-mono">
                    {walletAddress!.slice(0, 8)}…{walletAddress!.slice(-6)}
                  </p>
                </div>
              </div>

              <h2 className="text-[22px] text-[#F4F7EF] font-bold tracking-tight mb-1">
                Create your account
              </h2>
              <p className="text-[#90A89C] text-[14px] mb-8">
                Your wallet is connected. Click below to create your anonymous account — no personal info required.
              </p>

              <form onSubmit={handleWalletSignup} className="space-y-4">
                {walletError && (
                  <p className="text-red-400 text-[13px] text-center">{walletError}</p>
                )}

                <Button type="submit"
                  disabled={loading}
                  className="w-full mt-4 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#020D08]" /> : "Create Account & Go to Dashboard"}
                </Button>

                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full text-center text-[13px] text-[#90A89C] hover:text-[#F4F7EF] transition-colors cursor-pointer"
                >
                  ← Back to login
                </button>
              </form>
            </div>
          </div>
        )}

        {!isWalletSignup && (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 mt-[-20px]">
            <OnboardingHero />
            <div className="w-full max-w-[460px] flex flex-col gap-6">
              <ProfileSetupForm
                username={username}
                setUsername={setUsername}
                niche={niche}
                setNiche={setNiche}
                loading={loading}
                onSubmit={completeProfileSetup}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
