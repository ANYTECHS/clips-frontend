"use client";

import React, { useState } from "react";
import {
  CheckCircle2, Clock, Loader2, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink, Film,
} from "lucide-react";
import type { AgentJob } from "@/lib/queries";

interface JobCardProps {
  job: AgentJob;
  onViewClips?: (clipIds: number[]) => void;
}

const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    icon: Clock,         color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  PROCESSING: { label: "Processing", icon: Loader2,       color: "text-[#B6FF4A]",  bg: "bg-[#B6FF4A]/10 border-[#B6FF4A]/25", spin: true },
  COMPLETED:  { label: "Completed",  icon: CheckCircle2,  color: "text-[#B6FF4A]",  bg: "bg-[#B6FF4A]/10 border-[#B6FF4A]/25" },
  FAILED:     { label: "Failed",     icon: AlertCircle,   color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20" },
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function JobCard({ job, onViewClips }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;

  const shortUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 20) + (u.pathname.length > 20 ? "…" : "");
    } catch { return url.slice(0, 40); }
  };

  return (
    <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[20px] overflow-hidden hover:border-[#39FF14]/40 transition-all">
      {/* Main row */}
      <div className="flex items-center gap-4 p-5">
        {/* Status badge */}
        <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.color}`}>
          <Icon className={`w-3.5 h-3.5 ${"spin" in cfg && cfg.spin ? "animate-spin" : ""}`} />
          {cfg.label}
        </div>

        {/* URL + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#F4F7EF] truncate">{shortUrl(job.videoUrl)}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-[#90A89C]">Job #{job.id}</span>
            <span className="text-[11px] text-[#90A89C]">{job.style}</span>
            <span className="text-[11px] text-[#90A89C]">{timeAgo(job.createdAt)}</span>
          </div>
        </div>

        {/* Clip count */}
        {job.resultClipIds?.length > 0 && (
          <button
            onClick={() => onViewClips?.(job.resultClipIds)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[12px] font-bold hover:bg-[#B6FF4A]/25 transition-all"
          >
            <Film className="w-3.5 h-3.5" />
            {job.resultClipIds.length} clips
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="shrink-0 p-2 text-[#90A89C] hover:text-[#F4F7EF] transition-colors rounded-lg hover:bg-[#042413]"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#0e4d2a] px-5 py-4 space-y-3 bg-[#042413]">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="text-[#90A89C] font-medium mb-0.5">Contract Job ID</p>
              <p className="text-[#F4F7EF] font-mono">{job.contractJobId || "—"}</p>
            </div>
            <div>
              <p className="text-[#90A89C] font-medium mb-0.5">Agent ID</p>
              <p className="text-[#F4F7EF] font-mono">#{job.agentId}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[#90A89C] font-medium mb-0.5">Client Address</p>
              <p className="text-[#F4F7EF] font-mono break-all">{job.clientAddress || "—"}</p>
            </div>
            {job.txHash && job.txHash !== "manual" && (
              <div className="col-span-2">
                <p className="text-[#90A89C] font-medium mb-0.5">Tx Hash</p>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${job.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#B6FF4A] font-mono text-[11px] flex items-center gap-1 hover:underline break-all"
                >
                  {job.txHash.slice(0, 24)}… <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            {job.resultClipIds?.length > 0 && (
              <div className="col-span-2">
                <p className="text-[#90A89C] font-medium mb-1">Result Clip IDs</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.resultClipIds.map((id) => (
                    <span key={id} className="px-2 py-0.5 rounded-md bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[11px] font-bold">
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
