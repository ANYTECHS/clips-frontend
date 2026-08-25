"use client";

import React, { useEffect, useRef, useState } from "react";
import StatCard from "@/components/dashboard/StatCard";
import Skeleton from "@/components/ui/Skeleton";
import { Copy, Check, Users, DollarSign, Share2 } from "lucide-react";
import analytics from "@/app/lib/analytics";

type ReferralStats = {
  code: string;
  link: string;
  referralCount: number;
  totalEarned: number;
};

export default function ReferralPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/referral");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ReferralStats;
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load referral stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      analytics.trackEvent("referral_link_shared", { code: stats.code });
    } catch {
      inputRef.current?.select();
    }
  };

  const handleShare = () => {
    if (!stats) return;
    analytics.trackEvent("referral_link_shared", { code: stats.code });
    if (navigator.share) {
      navigator.share({ title: "Join ClipCash", text: "Use my referral link to sign up", url: stats.link }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white">Referral Program</h1>
          <p className="text-muted text-[14px] mt-1">Share your unique link and earn bonuses when friends join.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/6 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-6">
            <p className="text-error text-sm">{error}</p>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Referrals"
                value={String(stats.referralCount)}
                trend={`${stats.referralCount} joined`}
                icon={Users}
              />
              <StatCard
                label="Total Earned"
                value={`$${stats.totalEarned.toFixed(2)}`}
                trend="Referral bonuses"
                icon={DollarSign}
              />
              <StatCard
                label="Your Code"
                value={stats.code}
                trend="Unique per user"
                icon={Share2}
              />
            </div>

            <div className="bg-surface border border-white/5 rounded-2xl p-6">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Your Referral Link
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={inputRef}
                  readOnly
                  value={stats.link}
                  className="flex-1 bg-input text-white text-sm rounded-xl px-4 py-3 border border-white/10"
                />
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-surface hover:bg-input text-white font-bold transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}