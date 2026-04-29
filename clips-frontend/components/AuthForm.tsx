"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MockApi } from "@/app/lib/mockApi";

// Local inline SVG for Google/Apple to avoid external dependencies perfectly matching
const GoogleIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/></svg>
);

const AppleIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.26.68 3.01.68.75 0 1.95-.79 3.38-.68 1.48.06 2.62.66 3.32 1.65-2.85 1.76-2.38 5.48.51 6.64-.67 1.75-1.53 3.5-2.22 4.68zm-5.28-14.8c-.1-1.55 1.25-3.05 2.81-3.23.23 1.66-1.28 3.16-2.81 3.23z"/></svg>
);

interface AuthFormProps {
  mode?: "login" | "signup";
}

export default function AuthForm({ mode = "login" }: AuthFormProps) {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, ToastEl } = useToast();

  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      showToast("OAuth authentication failed. Please try again.", "error");
      // Remove error from URL
      router.replace("/login");
    }
  }, [searchParams, showToast, router]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (currentMode === "login") {
        const res = await MockApi.login(email, password);
        setUser(res.user);
      } else {
        const res = await MockApi.signup(email, password, fullName);
        setUser(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      const card = document.getElementById("auth-card");
      if (card) {
        card.classList.remove("shake");
        void card.offsetWidth; // trigger reflow
        card.classList.add("shake");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-card" className="w-[440px] bg-surface/80 backdrop-blur-md rounded-[20px] p-[38px] shadow-[0_4px_40px_rgba(0,0,0,0.5)] border border-border relative overflow-hidden">
      {/* Decorative inner glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand/10 rounded-full blur-[60px] pointer-events-none" />
      
      <h2 className="text-[28px] text-white font-bold tracking-tight mb-1">
        {currentMode === "login" ? "Welcome back" : "Create an account"}
      </h2>
      <p className="text-muted mb-8 text-[15px]">
        {currentMode === "login" ? "Log in to start creating viral content" : "Sign up to start creating viral content"}
      </p>
      
      <div className="space-y-[14px] mb-8">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-surface-hover hover:bg-border border border-border text-white py-3.5 rounded-[12px] font-medium transition-all text-[14px]"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => signIn("apple", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-surface-hover hover:bg-border border border-border text-white py-3.5 rounded-[12px] font-medium transition-all text-[14px]"
        >
          <AppleIcon />
          Continue with Apple
        </button>
      </div>

      <div className="flex items-center gap-4 text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase mb-8">
        <div className="flex-1 h-px bg-border" />
        OR EMAIL
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleAuthSubmit} className="space-y-4">
        {currentMode === "signup" && (
          <div>
            <label htmlFor="auth-name" className="block text-[13px] font-medium text-[#8e9895] mb-2">Full Name</label>
            <input 
              id="auth-name"
              type="text" 
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-surface-hover transition-colors"
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="block text-[13px] font-medium text-[#8e9895] mb-2">Email address</label>
          <input 
            id="auth-email"
            type="email" 
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-surface-hover transition-colors"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block text-[13px] font-medium text-[#8e9895] mb-2">Password</label>
          <input 
            id="auth-password"
            type="password" 
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-input border border-border text-white focus:border-brand/70 rounded-[12px] px-4 py-3.5 text-[14px] focus:outline-none focus:bg-surface-hover transition-colors"
          />
          {currentMode === "login" && (
            <div className="flex justify-end mt-3">
              <Link
                href="/forgot-password"
                className="text-brand font-medium hover:underline text-[13px]"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        {error && <div className="text-error text-[13px] text-center pt-1">{error}</div>}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-hover text-black py-[15px] rounded-[12px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all disabled:opacity-70 mt-[6px]"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : 
            (currentMode === "login" ? "Continue with Email" : "Create Account")}
        </button>
      </form>
      
      <div className="text-center mt-7 text-[13px] text-muted">
        {currentMode === "login" ? (
          <>New here? <button type="button" onClick={() => { setCurrentMode("signup"); setResetMessage(false); }} className="text-brand font-medium hover:underline">Sign up free</button></>
        ) : (
          <>Already have an account? <button type="button" onClick={() => { setCurrentMode("login"); setResetMessage(false); }} className="text-brand font-medium hover:underline">Sign in</button></>
        )}
      </div>
      <ToastEl />
    </div>
  );
}
