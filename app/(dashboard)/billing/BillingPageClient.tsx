"use client";

/**
 * BillingPageClient
 *
 * Receives server-fetched plans and user profile so the first render is
 * instant — no spinner for the plan cards. The upgrade flow (Stripe redirect)
 * and success-param handling remain fully client-side.
 */

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Zap,
  Sparkles,
  Shield,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useUserStore } from "@/app/store/userStore";
import type { BillingPlan } from "@/app/api/billing/plans/route";
import type { UserProfile } from "@/app/store/types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BillingPageClientProps {
  /** Static plan definitions fetched server-side (cached 1 h). */
  plans: BillingPlan[];
  /**
   * User profile fetched server-side. Used to seed the Zustand store so the
   * plan / quota UI renders immediately without a client-side fetch.
   * Null when the server fetch failed — the store will fetch lazily.
   */
  initialProfile: UserProfile | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingPageClient({
  plans,
  initialProfile,
}: BillingPageClientProps) {
  const searchParams = useSearchParams();

  // Seed the Zustand user store with server data on first render so the plan
  // badge and quota bar are correct without waiting for a client fetch.
  const setProfile  = useUserStore((s) => s.setProfile);
  const fetchUser   = useUserStore((s) => s.fetchUser);
  const currentPlan = useUserStore((s) => s.profile?.plan ?? initialProfile?.plan ?? "free");
  const planUsage   = useUserStore((s) => s.profile?.planUsagePercent ?? initialProfile?.planUsagePercent ?? 0);
  const quota       = useUserStore((s) => {
    const p = s.profile ?? initialProfile;
    if (!p) return 0;
    const limits: Record<string, number> = { free: 10, pro: 100, enterprise: 1000 };
    const limit = limits[p.plan] ?? 10;
    return Math.max(0, limit - Math.round((p.planUsagePercent / 100) * limit));
  });

  // Seed store on mount — only once, not on every render.
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    } else {
      // Server fetch failed — fall back to client-side fetch.
      fetchUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [successMessage, setSuccessMessage]   = useState<string | null>(null);

  const isSuccess         = searchParams.get("success") === "true";
  const upgradedPlanParam = searchParams.get("plan");

  // Handle return from Stripe checkout.
  useEffect(() => {
    if (isSuccess && upgradedPlanParam) {
      setSuccessMessage(
        `Successfully upgraded to ${upgradedPlanParam.toUpperCase()} plan! Your transform quota has been updated.`,
      );
      fetchUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, upgradedPlanParam]);

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    setUpgradingPlanId(planId);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to initiate checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout error");
      setUpgradingPlanId(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 py-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5" />
          Subscription &amp; Billing
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Manage Your Plan &amp; Quotas
        </h1>
        <p className="text-muted text-base max-w-2xl">
          Scale your viral video clip engine. Upgrade anytime to unlock higher
          AI transform quotas, 4K/8K export rendering, and priority GPU
          processing.
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-3 text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current plan summary */}
      <div className="bg-surface border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Active Plan
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-white capitalize">
                {currentPlan} Plan
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase">
                Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-muted block">Remaining Quota</span>
              <span className="text-xl font-extrabold text-brand">
                {quota} Transforms
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm font-bold">
            <span className="text-white">Monthly Quota Consumption</span>
            <span className={planUsage >= 90 ? "text-red-400" : "text-brand"}>
              {planUsage}% Used
            </span>
          </div>
          <div className="relative h-3 w-full bg-input rounded-full overflow-hidden border border-white/5">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                planUsage >= 90
                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  : planUsage >= 70
                  ? "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                  : "bg-brand shadow-[0_0_12px_rgba(0,229,143,0.5)]"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, planUsage))}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Quotas reset at the beginning of each billing cycle. Upgrading
            immediately adds new transform capacity.
          </p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Available Plans
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent  = currentPlan === p.id;
            const isUpgrading = upgradingPlanId === p.id;

            return (
              <div
                key={p.id}
                className={`relative bg-surface border rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 ${
                  p.popular
                    ? "border-brand/50 shadow-[0_0_30px_rgba(0,229,143,0.15)] bg-surface/90"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand text-black font-extrabold text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-black" /> Most Popular
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{p.name}</h3>
                    <p className="text-muted text-xs min-h-[36px]">{p.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">${p.price}</span>
                    <span className="text-muted text-xs font-semibold">/{p.interval}</span>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-white/5">
                    <span className="text-xs font-bold text-white/80 block">
                      Included Features:
                    </span>
                    {p.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-muted">
                        <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-white/5">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl text-xs font-bold bg-white/5 text-white/50 border border-white/5 cursor-default flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(p.id)}
                      disabled={!!upgradingPlanId}
                      className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        p.popular
                          ? "bg-brand text-black hover:bg-brand-hover shadow-[0_0_20px_rgba(0,229,143,0.3)]"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      } disabled:opacity-50`}
                    >
                      {isUpgrading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
                        </>
                      ) : (
                        <>
                          Upgrade to {p.name} <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security note */}
      <div className="bg-input border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-brand shrink-0" />
          <div className="text-xs text-muted">
            <span className="font-bold text-white block">Secure Stripe Checkout</span>
            Encrypted payment processing. Upgrade or cancel anytime from your
            billing dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
