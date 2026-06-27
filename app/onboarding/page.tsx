/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Link2, User as UserIcon, MonitorPlay, ArrowRight, CheckCircle2, Wallet, Info } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { useEmbeddedWallet } from "@/components/EmbeddedWalletProvider";
import { useToast } from "@/hooks/useToast";
import { fundWithFriendbot } from "@/app/lib/stellar";
import { IS_TESTNET } from "@/app/lib/networkConfig";
import { useBalance } from "@/app/hooks/useBalance";
import Image from "next/image";

import InstagramIcon from "@/components/icons/InstagramIcon";
import YoutubeIcon from "@/components/icons/YoutubeIcon";

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

interface OnboardingStep1Data {
  name: string;
  username: string;
  bio: string;
  niche: string;
}

interface OnboardingStep2Data {
  tiktok: string;
  instagram: string;
  youtube: string;
}

type OnboardingErrors = Partial<Record<keyof OnboardingStep1Data | keyof OnboardingStep2Data, string>>;

function validateOnboardingStep(step: number, data: Record<string, string>): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (step === 1) {
    if (!data.name?.trim()) errors.name = "Full name is required";
    
    if (!data.username?.trim()) {
      errors.username = "Username is required";
    } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(data.username)) {
      errors.username = "3-30 characters, alphanumeric and underscores only";
    }

    if (data.bio?.length > 160) {
      errors.bio = "Bio cannot exceed 160 characters";
    }

    if (!data.niche) errors.niche = "Please select your creator niche";
  } else if (step === 2) {
    const handleRegex = /^@?[\w.]{1,30}$/;
    const urlRegex = /^https?:\/\/.+/;

    const validateHandle = (field: keyof OnboardingStep2Data, label: string) => {
      const val = data[field]?.trim();
      if (val && !handleRegex.test(val) && !urlRegex.test(val)) {
        errors[field] = `Invalid ${label} format (use @handle or URL)`;
      }
    };

    validateHandle("tiktok", "TikTok");
    validateHandle("instagram", "Instagram");
    validateHandle("youtube", "YouTube");
  }

  return errors;
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p 
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-[12px] text-red-400 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {message}
    </p>
  );
}

function WalletAwarenessStep({ onContinue, loading }: { onContinue: () => void; loading: boolean }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const { wallet } = useEmbeddedWallet();
  const { success, error } = useToast();
  const isMountedRef = useRef(true);
  const fundedKeyRef = useRef<string | null>(null);

  const { refresh } = useBalance({
    publicKey: wallet?.publicKey || null,
    network: IS_TESTNET ? "TESTNET" : "PUBLIC",
    autoRefresh: false,
  });

  useEffect(() => {
    isMountedRef.current = true;

    // Auto-fund on testnet when wallet is available
    const fundWallet = async () => {
      if (!wallet?.publicKey) return;

      // Only fund once per wallet public key
      if (fundedKeyRef.current === wallet.publicKey) return;

      // Check conditions inside the effect body (not in deps)
      if (!IS_TESTNET) return;

      fundedKeyRef.current = wallet.publicKey;
      setIsFunding(true);
      setFundingError(null);
      
      try {
        await fundWithFriendbot(wallet.publicKey);
        if (!isMountedRef.current) return;
        setFundingSuccess(true);
        success("Wallet funded with 10,000 XLM!");
        
        // Refresh balance a few times to ensure it updates
        for (let i = 0; i < 5; i++) {
          if (!isMountedRef.current) return;
          await new Promise(resolve => setTimeout(resolve, 1000));
          refresh();
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error("Friendbot funding failed:", err);
        setFundingError(err instanceof Error ? err.message : "Failed to fund wallet");
        error("Wallet funding failed. Please try again later.");
      } finally {
        if (isMountedRef.current) {
          setIsFunding(false);
        }
      }
    };

    fundWallet();

    return () => {
      isMountedRef.current = false;
    };
  }, [wallet?.publicKey]);

  return (
    <div className="w-full flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-500 mt-12">
      <div className="w-full max-w-[480px] bg-surface/90 backdrop-blur-md rounded-[24px] p-8 sm:p-10 border border-border shadow-[0_4px_40px_rgba(0,0,0,0.5)] text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-brand" />
        </div>

        <h2 className="text-[32px] font-bold tracking-tight text-white mb-3">
          Your payment wallet is ready! 🎉
        </h2>
        <p className="text-muted text-[16px] leading-relaxed mb-6">
          We've automatically set up a Stellar wallet for you. You can use it to receive earnings, mint NFTs, and manage your creator payments — no crypto experience needed.
        </p>

        {/* Testnet Funding Status */}
        {IS_TESTNET && (
          <div className="mb-6 p-4 bg-brand/10 border border-brand/20 rounded-xl text-left">
            {isFunding && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand animate-spin" />
                <p className="text-[14px] font-bold text-brand">Funding your wallet with 10,000 XLM...</p>
              </div>
            )}
            {fundingSuccess && (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                <p className="text-[14px] font-bold text-brand">Wallet funded with 10,000 XLM! 🎊</p>
              </div>
            )}
            {fundingError && !isFunding && (
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-500" />
                <p className="text-[14px] font-bold text-amber-500">Funding temporarily unavailable. You can still continue.</p>
              </div>
            )}
          </div>
        )}

        {/* Mainnet CTA */}
        {!IS_TESTNET && (
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-white shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-white mb-1">Fund your wallet</p>
                <p className="text-[12px] text-muted leading-relaxed">
                  On mainnet, you'll need to fund your wallet with XLM to get started. You can do this from your dashboard after onboarding.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="relative inline-block mb-6">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="flex items-center gap-1.5 text-brand text-[13px] font-medium hover:underline mx-auto"
          >
            <Info className="w-4 h-4" />
            Learn more about your wallet
          </button>

          {showTooltip && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-surface border border-border rounded-xl p-4 text-left shadow-xl z-10 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[13px] text-white font-bold mb-2">What is a Stellar wallet?</p>
              <ul className="space-y-1.5 text-[12px] text-muted">
                <li>• It's like a bank account on the Stellar blockchain — fast and nearly free to use.</li>
                <li>• Your wallet is secured with AES-GCM encryption and stored only on your device.</li>
                <li>• You can export your secret key anytime from Settings → Advanced Wallet.</li>
                <li>• Earnings from your clips can be paid directly to this wallet.</li>
              </ul>
              <button
                onClick={() => setShowTooltip(false)}
                className="mt-3 text-[11px] text-muted hover:text-white transition-colors"
              >
                Got it ✕
              </button>
            </div>
          )}
        </div>

        {/* Backup Reminder */}
        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left animate-pulse">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-bold text-amber-500 mb-1">Important: Backup your wallet!</p>
              <p className="text-[12px] text-amber-200/80 leading-relaxed">
                Since we don't store your keys, you must backup your secret key to ensure you never lose access to your funds. You can do this in your Dashboard settings later.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          disabled={loading || isFunding}
          className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.1)]"
        >
          {loading || isFunding ? <Loader2 className="animate-spin w-5 h-5" /> : <>Go to Dashboard <CheckCircle2 className="w-[18px] h-[18px]" /></>}
        </button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [step1Form, setStep1Form] = useState<OnboardingStep1Data>({
    name: user?.name || "",
    username: user?.profile?.username || "",
    bio: (user?.profile?.bio as string) || "",
    niche: user?.profile?.niche || "",
  });

  const [step2Form, setStep2Form] = useState<OnboardingStep2Data>({
    tiktok: (user?.profile?.tiktok as string) || "",
    instagram: (user?.profile?.instagram as string) || "",
    youtube: (user?.profile?.youtube as string) || "",
  });

  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const step = user?.onboardingStep === 1 ? 1 : user?.onboardingStep === 2 ? 2 : 3;

  const handleStep1Change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updated = { ...step1Form, [name]: value };
    setStep1Form(updated);
    if (touched[name]) {
      setErrors(validateOnboardingStep(1, updated));
    }
  };

  const handleStep2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...step2Form, [name]: value };
    setStep2Form(updated);
    if (touched[name]) {
      setErrors(validateOnboardingStep(2, updated));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(validateOnboardingStep(step, step === 1 ? step1Form : step2Form));
  };

  const completeStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Mark all as touched
    const allTouched = Object.fromEntries(Object.keys(step1Form).map(k => [k, true]));
    setTouched(allTouched);

    const errs = validateOnboardingStep(1, step1Form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 2, data: step1Form }),
      });
      if (!res.ok) throw new Error("Failed to save onboarding step 1");
      const { onboardingStep } = await res.json();
      setUser({ 
        ...user, 
        onboardingStep: onboardingStep ?? 2, 
        name: step1Form.name,
        profile: { ...user.profile, ...step1Form } 
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const completeStep2 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    const allTouched = Object.fromEntries(Object.keys(step2Form).map(k => [k, true]));
    setTouched(allTouched);

    const errs = validateOnboardingStep(2, step2Form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3, data: { ...step2Form, socialsConnected: true } }),
      });
      if (!res.ok) throw new Error("Failed to save onboarding step 2");
      const { onboardingStep } = await res.json();
      setUser({ 
        ...user, 
        onboardingStep: onboardingStep ?? 3, 
        profile: { ...user.profile, ...step2Form, socialsConnected: true } 
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const completeStep3 = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 4, data: { walletAcknowledged: true } }),
      });
      if (!res.ok) throw new Error("Failed to save onboarding step 3");
      const { onboardingStep } = await res.json();
      setUser({ ...user, onboardingStep: onboardingStep ?? 4, profile: { ...user.profile, walletAcknowledged: true } });
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full bg-input border text-white rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-all placeholder-subtle ${
      touched[field] && errors[field as keyof OnboardingErrors]
        ? "border-red-500/50 bg-red-500/5 focus:border-red-500"
        : "border-border focus:border-brand/70 focus:bg-surface-hover"
    }`;

  return (
    <div className="min-h-screen text-white font-sans flex flex-col relative overflow-hidden bg-background">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.07] rounded-full blur-[120px] pointer-events-none translate-x-1/3" />
      
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">
        
        {step === 1 ? (
          <div className="w-full flex flex-col lg:flex-row items-start justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-20px]">
            {/* Left side - Progress */}
            <div className="flex-1 space-y-8 max-w-[500px]">
              <div className="text-brand text-[11px] font-bold tracking-[0.1em] uppercase">ONBOARDING EXPERIENCE</div>
              
              <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
                Turn your long-<br/>form <span className="text-brand">content into</span><br/>
                <span className="text-brand">gold.</span>
              </h1>
              
              <p className="text-muted text-[16px] max-w-[420px] leading-[1.6]">
                Our AI identifies the most viral moments from your videos and formats them for every platform instantly.
              </p>
              
              {/* Progress Card */}
              <div className="bg-surface border border-border rounded-[20px] p-[24px] mt-8 w-full shadow-lg">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5">CURRENT PROGRESS</div>
                    <div className="font-bold text-white text-[15px]">Step 1 of 2: Profile Setup</div>
                  </div>
                  <div className="text-[28px] font-extrabold text-brand leading-none">
                    50%
                  </div>
                </div>
                <div className="w-full h-[10px] bg-input rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)]" style={{ width: "50%" }} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-[13px] text-muted-foreground pt-4">
                <div className="flex -space-x-2.5">
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-800 flex items-center justify-center overflow-hidden"><Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nico&backgroundColor=c0aede" alt="" width={36} height={36} className="w-full h-full object-cover"/></div>
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-700 flex items-center justify-center overflow-hidden"><Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jane&backgroundColor=b6e3f4" alt="" width={36} height={36} className="w-full h-full object-cover"/></div>
                  <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-600 flex items-center justify-center overflow-hidden"><Image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&backgroundColor=c0aede" alt="" width={36} height={36} className="w-full h-full object-cover"/></div>
                </div>
                <div>Joined by <span className="font-bold text-white">2,500+</span> top creators this month.</div>
              </div>
            </div>

            {/* Right side - Forms container Stack */}
            <div className="w-full max-w-[440px] flex flex-col gap-6">
              
              {/* Active Step 1 Form Card */}
              <div className="bg-surface/90 backdrop-blur-md rounded-[20px] p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-border relative overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-9 h-9 rounded-[8px] bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-[18px] font-bold text-white tracking-tight">Basic Information</h2>
                </div>
                
                <form onSubmit={completeStep1} className="space-y-[18px]">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[13px] font-medium text-muted mb-2">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={step1Form.name} 
                      onChange={handleStep1Change}
                      onBlur={handleBlur}
                      className={inputClass("name")}
                      placeholder="e.g. Alex Rivera"
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                    <FieldError id="name-error" message={touched.name ? errors.name : undefined} />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-[13px] font-medium text-muted mb-2">Username</label>
                    <input 
                      type="text" 
                      name="username"
                      value={step1Form.username} 
                      onChange={handleStep1Change}
                      onBlur={handleBlur}
                      className={inputClass("username")}
                      placeholder="e.g. alexrivera"
                      aria-describedby={errors.username ? "username-error" : undefined}
                    />
                    <FieldError id="username-error" message={touched.username ? errors.username : undefined} />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-[13px] font-medium text-muted mb-2">Bio</label>
                    <textarea 
                      name="bio"
                      value={step1Form.bio} 
                      onChange={handleStep1Change}
                      onBlur={handleBlur}
                      rows={3}
                      className={`${inputClass("bio")} resize-none`}
                      placeholder="Tell us about yourself..."
                      aria-describedby={errors.bio ? "bio-error" : undefined}
                    />
                    <div className="flex items-start justify-between mt-1.5">
                      <FieldError id="bio-error" message={touched.bio ? errors.bio : undefined} />
                      <span className={`text-[11px] ml-auto shrink-0 ${step1Form.bio.length > 160 ? "text-red-400" : "text-subtle"}`}>
                        {step1Form.bio.length}/160
                      </span>
                    </div>
                  </div>

                  {/* Creator Type */}
                  <div>
                    <label className="block text-[13px] font-medium text-muted mb-2">Creator Type</label>
                    <div className="relative">
                      <select 
                        name="niche"
                        value={step1Form.niche} 
                        onChange={handleStep1Change}
                        onBlur={handleBlur}
                        className={`${inputClass("niche")} appearance-none [&>option]:text-black`}
                        aria-describedby={errors.niche ? "niche-error" : undefined}
                      >
                        <option value="" disabled className="text-muted-foreground">Select your niche</option>
                        <option value="gaming">Gaming</option>
                        <option value="podcast">Podcast</option>
                        <option value="vlog">Vlog & Lifestyle</option>
                        <option value="educational">Educational</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <FieldError id="niche-error" message={touched.niche ? errors.niche : undefined} />
                  </div>
                  
                  <button 
                    type="submit" disabled={loading}
                    className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 mt-[8px] transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.1)]"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <>Continue to step 2 <ArrowRight className="w-[18px] h-[18px]"/></>}
                  </button>
                </form>
              </div>
              
              {/* Disabled Step 2 Preview Card */}
              <div className="bg-surface/60 backdrop-blur-md rounded-[20px] p-[38px] border border-border opacity-70 saturate-50 pointer-events-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-[8px] bg-input border border-border text-subtle flex items-center justify-center">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-[18px] font-bold text-muted tracking-tight">Connect Social Accounts</h2>
                </div>
                
                <div className="space-y-3">
                  {["TikTok", "Instagram", "YouTube"].map((name, i) => (
                    <div key={i} className="w-full bg-input border border-border rounded-[12px] px-4 py-3.5 flex items-center gap-3">
                      <div className="w-[22px] h-[22px] rounded-full bg-surface-hover text-subtle flex items-center justify-center">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <span className="text-muted text-[14px] font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : step === 2 ? (
          /* Step 2 Full Screen Centered Flow */
          <div className="w-full flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-500 mt-12">
            <div className="text-center mb-10">
              <h2 className="text-[32px] font-bold tracking-tight text-white mb-3">Step 2: Connect your socials</h2>
              <p className="text-muted text-[16px]">Enter your handles to start importing your content.</p>
            </div>
            
            <form onSubmit={completeStep2} className="w-full max-w-[480px] bg-surface/90 backdrop-blur-md rounded-[24px] p-8 sm:p-10 border border-border shadow-[0_4px_40px_rgba(0,0,0,0.5)] space-y-6">
              {/* TikTok */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-muted mb-2">
                  <MonitorPlay className="w-4 h-4 text-white" /> TikTok Handle
                </label>
                <input 
                  type="text" 
                  name="tiktok"
                  value={step2Form.tiktok} 
                  onChange={handleStep2Change}
                  onBlur={handleBlur}
                  className={inputClass("tiktok")}
                  placeholder="@username or profile URL"
                  aria-describedby={errors.tiktok ? "tiktok-error" : undefined}
                />
                <FieldError id="tiktok-error" message={touched.tiktok ? errors.tiktok : undefined} />
              </div>

              {/* Instagram */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-muted mb-2">
                  <InstagramIcon className="w-4 h-4 text-[#E1306C]" /> Instagram Handle
                </label>
                <input 
                  type="text" 
                  name="instagram"
                  value={step2Form.instagram} 
                  onChange={handleStep2Change}
                  onBlur={handleBlur}
                  className={inputClass("instagram")}
                  placeholder="@username or profile URL"
                  aria-describedby={errors.instagram ? "instagram-error" : undefined}
                />
                <FieldError id="instagram-error" message={touched.instagram ? errors.instagram : undefined} />
              </div>

              {/* YouTube */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-muted mb-2">
                  <YoutubeIcon className="w-4 h-4 text-[#FF0000]" /> YouTube Channel
                </label>
                <input 
                  type="text" 
                  name="youtube"
                  value={step2Form.youtube} 
                  onChange={handleStep2Change}
                  onBlur={handleBlur}
                  className={inputClass("youtube")}
                  placeholder="@handle or channel URL"
                  aria-describedby={errors.youtube ? "youtube-error" : undefined}
                />
                <FieldError id="youtube-error" message={touched.youtube ? errors.youtube : undefined} />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" disabled={loading}
                  className="w-full bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(0,229,143,0.1)]"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <>Continue <ArrowRight className="w-[18px] h-[18px]"/></>}
                </button>
                
                <button 
                  type="button"
                  onClick={() => completeStep2()}
                  className="w-full text-center text-muted-foreground hover:text-white text-[13px] font-medium mt-4 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 3 — Wallet Awareness */
          <WalletAwarenessStep onContinue={completeStep3} loading={loading} />
        )}
      </main>
    </div>
  );
}
