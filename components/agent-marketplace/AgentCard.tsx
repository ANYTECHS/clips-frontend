"use client";

import React from "react";
import { Bot, Zap, Wallet, ExternalLink } from "lucide-react";
import type { Agent } from "@/lib/queries";
import Button from "@/components/shared/Button";

interface AgentCardProps {
  agent: Agent;
  onHire: (agent: Agent) => void;
  isFirstFreeJob?: boolean;
}

export default function AgentCard({ agent, onHire, isFirstFreeJob = false }: AgentCardProps) {
  const shortAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

  return (
    <div className="group relative bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-6 flex flex-col gap-5 hover:border-[#39FF14]/40 transition-all duration-300 hover:shadow-[0_0_35px_rgba(57,255,20,0.12)]">
      {/* Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#39FF14]/10 blur-[60px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6 text-[#B6FF4A]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#F4F7EF] leading-tight truncate">{agent.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-[11px] font-bold text-[#B6FF4A] uppercase tracking-widest">Active</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-[#90A89C] leading-relaxed line-clamp-3 flex-1">
        {agent.description}
      </p>

      {/* Meta */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#90A89C] font-medium flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-[#B6FF4A]" /> Price per job
          </span>
          {isFirstFreeJob ? (
            <span className="text-[#B6FF4A] font-black flex items-center gap-1.5">
              <span className="line-through text-[#90A89C] text-[11px] font-normal">$0.50</span>
              FREE (1st Job)
            </span>
          ) : (
            <span className="text-[#F4F7EF] font-black">$0.50 USDC</span>
          )}
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#90A89C] font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#B6FF4A]" /> Contract
          </span>
          <span className="text-[#B6FF4A] font-mono">{shortAddress(agent.contractAddress)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#90A89C] font-medium flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-[#B6FF4A]" /> Agent wallet
          </span>
          <span className="text-[#B6FF4A] font-mono">{shortAddress(agent.walletAddress)}</span>
        </div>
      </div>

      {/* CTA */}
      <Button onClick={() => onHire(agent)}
        className="w-full"
      >
        {isFirstFreeJob ? "Try Agent Free" : "Hire Agent"}
      </Button>
    </div>
  );
}
