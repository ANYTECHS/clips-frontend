"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Bot, Sparkles, Loader2,
  Zap, CreditCard, Crown, X,
} from "lucide-react";
import {
  getAgents,
  getMySubscription,
  checkUserHasEverClipped,
  type Agent,
  type StellarSubscription,
} from "@/lib/queries";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import { markFreeJobAsClaimed, useFreeJobClaimed } from "@/lib/freeJobStore";
import { loadActiveJob, clearActiveJob } from "@/lib/processingStore";
import AgentCard from "./AgentCard";
import HireAgentModal from "./HireAgentModal";

type Tab = "agents" | "jobs" | "subscription";

export default function AgentMarketplaceContent() {
  const router = useRouter();

  const { address } = useWallet();
  const { user, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [hiringAgent, setHiringAgent] = useState<Agent | null>(null);
  const [latestJobId, setLatestJobId] = useState<number | null>(null);
  const [activeJob, setActiveJob] = useState<{ videoId: string; startedAt: number } | null>(null);

  useEffect(() => {
    const job = loadActiveJob();
    if (!job) return;
    const AGE_LIMIT = 30 * 60 * 1000;
    if (Date.now() - job.startedAt > AGE_LIMIT) {
      clearActiveJob();
      return;
    }
    setActiveJob(job);
  }, []);

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: getAgents,
    staleTime: 5 * 60_000,
  });

  const { data: subscription } = useQuery<StellarSubscription | null>({
    queryKey: ["mySubscription"],
    queryFn: getMySubscription,
    staleTime: 30_000,
  });

  const { data: hasEverClipped = false, isLoading: checkingHistory } = useQuery<boolean>({
    queryKey: ["userHasEverClipped"],
    queryFn: checkUserHasEverClipped,
    staleTime: 15_000,
  });

  const hasActiveSub = subscription?.status === "ACTIVE";

  const userIdentifiers = [user?.id, user?.email, address];
  const isClaimed = useFreeJobClaimed(userIdentifiers);

  useEffect(() => {
    if (hasEverClipped) {
      markFreeJobAsClaimed([user?.id, user?.email, address]);
    }
  }, [hasEverClipped, user?.id, user?.email, address]);

  const isFirstFreeJob =
    !authLoading &&
    !checkingHistory &&
    !hasActiveSub &&
    !isClaimed &&
    !activeJob &&
    !hasEverClipped;

  const handleJobCreated = (jobId: number) => {
    setLatestJobId(jobId);
    setHiringAgent(null);
    setActiveTab("agents");
    const job = loadActiveJob();
    if (job) setActiveJob(job);
  };

  const TABS = [
    { key: "agents" as Tab, label: "Available Agents", icon: Bot },
    { key: "subscription" as Tab, label: "Subscription", icon: Crown },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-10 max-w-[1400px] mx-auto w-full space-y-10">

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 text-[#B6FF4A] text-[11px] font-black tracking-widest uppercase">
            <Bot className="w-3.5 h-3.5" />
            On-Chain AI Agents
          </div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-[#F4F7EF] leading-tight">
            Agent Marketplace
          </h1>
          <p className="text-[#90A89C] text-[15px] font-medium max-w-lg leading-relaxed">
            Hire hireable AI agents to clip your videos. Pay $0.50 USDC per job or subscribe for
            unlimited jobs — all settled on the Stellar network.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className="text-[26px] font-black text-[#F4F7EF] leading-none">{agents.length}</p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">Agents</p>
          </div>
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className="text-[26px] font-black text-[#B6FF4A] leading-none">
              {isFirstFreeJob ? "FREE" : "$0.50"}
            </p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">
              {isFirstFreeJob ? "1st Job" : "Per Job"}
            </p>
          </div>
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className={`text-[26px] font-black leading-none ${hasActiveSub ? "text-[#B6FF4A]" : "text-[#5A7A6B]"}`}>
              {hasActiveSub ? subscription!.plan : "—"}
            </p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">Plan</p>
          </div>
        </div>
      </div>

      {activeJob && (
        <div className="relative flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-[#06351C] border border-[#39FF14]/30 shadow-[0_0_30px_rgba(57,255,20,0.1)]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#39FF14]/30 blur-md animate-pulse" />
              <div className="relative w-9 h-9 rounded-full bg-[#042413] border border-[#39FF14]/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#39FF14]" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#F4F7EF] leading-snug">
                AI Agent is clipping your video in the background
              </p>
              <p className="text-xs text-[#90A89C] font-medium mt-0.5 truncate">
                Moments are being analyzed and rendered — watch live progress or stay right here
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => router.push(`/dashboard/processing?videoId=${activeJob.videoId}`)}
              className="px-5 py-2 rounded-xl bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] text-xs font-black tracking-wide transition-all active:scale-[0.97] shadow-[0_0_15px_rgba(57,255,20,0.25)]"
            >
              Watch Progress
            </button>
            <button
              onClick={() => {
                clearActiveJob();
                setActiveJob(null);
              }}
              aria-label="Dismiss"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5 text-[#90A89C] hover:text-[#F4F7EF] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isFirstFreeJob && (
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#00C853]/20 via-[#042413] to-[#06351C] border border-[#00C853]/35 p-5 sm:p-6 shadow-[0_0_50px_rgba(57,255,20,0.08)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                <Sparkles className="w-5 h-5 text-[#B6FF4A]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold text-[#F4F7EF]">
                    Welcome Gift: Your 1st Agent Job is 100% Free!
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#B6FF4A] text-[#020D08] text-[10px] font-black uppercase tracking-wider">
                    0.00 USDC
                  </span>
                </div>
                <p className="text-[13px] text-[#90A89C] mt-0.5">
                  We cover your first AI clipping job completely. Hire any agent below to test viral moment extraction with zero fee!
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (agents.length > 0) setHiringAgent(agents[0]);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black text-[13px] transition-all shadow-[0_0_15px_rgba(57,255,20,0.25)] shrink-0 active:scale-[0.98]"
            >
              Claim Free Job →
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-[#0e4d2a] pb-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-[13px] font-bold border-b-2 -mb-px transition-all ${
              activeTab === key
                ? "border-[#B6FF4A] text-[#B6FF4A]"
                : "border-transparent text-[#90A89C] hover:text-[#F4F7EF]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === "jobs" && latestJobId && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#B6FF4A]/20 text-[#B6FF4A] text-[9px] font-black">NEW</span>
            )}
          </button>
        ))}
      </div>


      {/* AGENTS */}
      {activeTab === "agents" && (
        <div>
          {agentsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
              <div className="w-16 h-16 rounded-[20px] bg-[#06351C] border border-[#0e4d2a] flex items-center justify-center">
                <Bot className="w-8 h-8 text-[#5A7A6B]" />
              </div>
              <p className="text-[#F4F7EF] font-bold text-[16px]">No agents registered yet</p>
              <p className="text-[#90A89C] text-[13px]">Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-16">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onHire={setHiringAgent}
                  isFirstFreeJob={isFirstFreeJob}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBSCRIPTION */}
      {activeTab === "subscription" && (
        <SubscriptionPanel
          subscription={subscription ?? null}
          isLoading={false}
          onHireWithSub={() => {
            if (agents.length > 0) setHiringAgent(agents[0]);
            else setActiveTab("agents");
          }}
        />
      )}

      {hiringAgent && (
        <HireAgentModal
          agent={hiringAgent}
          onClose={() => setHiringAgent(null)}
          onJobCreated={handleJobCreated}
        />
      )}
    </div>
  );
}


const PLAN_DETAILS = {
  STARTER: { label: "Starter",  price: "$9.99/mo",  jobs: "20 jobs/mo",   color: "from-white/5 to-white/0",             badge: "text-[#F4F7EF]",  icon: Zap },
  CREATOR: { label: "Creator",  price: "$24.99/mo", jobs: "60 jobs/mo",   color: "from-[#B6FF4A]/10 to-[#B6FF4A]/0",    badge: "text-[#B6FF4A]",  icon: Sparkles },
  PRO:     { label: "Pro",      price: "$49.99/mo", jobs: "150 jobs/mo",  color: "from-purple-400/10 to-purple-400/0", badge: "text-purple-400", icon: Crown },
};

function SubscriptionPanel({
  subscription,
  isLoading,
  onHireWithSub,
}: {
  subscription: StellarSubscription | null;
  isLoading: boolean;
  onHireWithSub: () => void;
}) {

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
      </div>
    );
  }

  const isActive = subscription?.status === "ACTIVE";

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Current status card */}
      <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isActive ? "bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A]" : "bg-[#042413] text-[#90A89C]"
            }`}>
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[#F4F7EF] font-extrabold text-[18px]">
                  {isActive ? `${subscription.plan} Plan` : "No Active Subscription"}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isActive
                    ? "bg-[#B6FF4A]/15 text-[#B6FF4A] border border-[#B6FF4A]/30"
                    : "bg-[#042413] text-[#90A89C] border border-[#0e4d2a]"
                }`}>
                  {isActive ? "Active" : "Free Tier"}
                </span>
              </div>
              <p className="text-[#90A89C] text-[13px] mt-0.5">
                {isActive
                  ? `Renews / expires: ${new Date(subscription.expiresAt).toLocaleDateString()}`
                  : "Pay $0.50 USDC per job or subscribe to save up to 40%."}
              </p>
            </div>
          </div>

          {isActive && (
            <button
              onClick={onHireWithSub}
              className="px-5 py-2.5 rounded-[14px] bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black text-[13px] transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(57,255,20,0.25)] shrink-0"
            >
              Hire Agent (Subscribed)
            </button>
          )}
        </div>
      </div>

      {/* Plan comparison if not subscribed */}
      {!isActive && (
        <>
          <div>
            <h3 className="text-[#F4F7EF] font-extrabold text-[20px]">Choose a Monthly Plan</h3>
            <p className="text-[#90A89C] text-[14px] mt-1">
              Billed in USDC on Stellar. Cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(["STARTER", "CREATOR", "PRO"] as const).map((planKey) => {
              const p = PLAN_DETAILS[planKey];
              const Icon = p.icon;
              return (
                <div
                  key={planKey}
                  className={`relative rounded-[24px] bg-gradient-to-b ${p.color} bg-[#06351C] border border-[#0e4d2a] p-6 flex flex-col justify-between hover:border-[#39FF14]/40 transition-all`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center">
                        <Icon className={`w-5 h-5 ${p.badge}`} />
                      </div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${p.badge}`}>
                        {p.label}
                      </span>
                    </div>

                    <div>
                      <p className="text-[28px] font-black text-[#F4F7EF]">{p.price}</p>
                      <p className="text-[12px] text-[#90A89C] mt-0.5">{p.jobs}</p>
                    </div>
                  </div>

                  <button
                    onClick={onHireWithSub}
                    className="mt-6 w-full py-2.5 rounded-[12px] bg-[#042413] hover:bg-[#084223] text-[#F4F7EF] font-bold text-[13px] border border-[#0e4d2a] hover:border-[#B6FF4A]/40 transition-all"
                  >
                    Select Plan
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pay per job option */}
          <div className="flex items-center gap-4 px-5 py-4 rounded-[20px] bg-[#06351C] border border-[#0e4d2a]">
            <CreditCard className="w-5 h-5 text-[#90A89C] shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[#F4F7EF]">No subscription needed</p>
              <p className="text-[12px] text-[#90A89C]">Pay $0.50 USDC per job — no commitment, no monthly fee.</p>
            </div>
            <button
              onClick={onHireWithSub}
              className="px-5 py-2.5 rounded-[12px] bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 text-[#B6FF4A] font-bold text-[13px] hover:bg-[#B6FF4A]/20 transition-all shrink-0"
            >
              Hire Now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
