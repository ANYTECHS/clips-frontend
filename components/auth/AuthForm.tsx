"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

interface AuthFormProps {
  mode?: "login" | "signup";
}

export default function AuthForm({ mode = "login" }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // For now, this is a placeholder for email/password auth
      // In production, integrate with your backend
      console.log(`${mode} attempt with:`, { email, password });
      setError("Email/password auth not yet implemented. Use OAuth providers below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn(provider, { redirect: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to sign in with ${provider}`);
      setIsLoading(false);
    }
  };

  const oauthProviders = [
    { id: "google", label: "Google", icon: "🔍" },
    { id: "apple", label: "Apple", icon: "🍎" },
    { id: "twitter", label: "Twitter/X", icon: "𝕏" },
    { id: "instagram", label: "Instagram", icon: "📷" },
    { id: "tiktok", label: "TikTok", icon: "🎵" },
  ];

  return (
    <div className="w-full max-w-[440px] bg-input/40 border border-subtle rounded-[20px] p-8 backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-2">
        {mode === "login" ? "Welcome Back" : "Get Started"}
      </h2>
      <p className="text-muted text-sm mb-8">
        {mode === "login"
          ? "Sign in to your ClipCash account"
          : "Create your ClipCash account"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full bg-input/60 border border-subtle rounded-[12px] px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-brand/50 focus:bg-input transition-all"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full bg-input/60 border border-subtle rounded-[12px] px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-brand/50 focus:bg-input transition-all"
          />
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand hover:bg-brand-hover text-black px-4 py-3 rounded-[12px] font-bold text-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-subtle" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-input/40 text-muted">Or continue with</span>
        </div>
      </div>

      <div className="space-y-3">
        {oauthProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleOAuthSignIn(provider.id)}
            disabled={isLoading}
            className="w-full bg-input/60 hover:bg-input/80 border border-subtle rounded-[12px] px-4 py-3 text-sm font-medium transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            <span className="text-lg">{provider.icon}</span>
            {provider.label}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted mt-6">
        {mode === "login" ? (
          <>
            Don't have an account?{" "}
            <a href="/signup" className="text-brand hover:text-brand-hover">
              Sign up
            </a>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <a href="/login" className="text-brand hover:text-brand-hover">
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
