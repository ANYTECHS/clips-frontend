"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BriefcaseBusiness, RefreshCw } from "lucide-react";
import { getAgentJobs, type AgentJob } from "@/lib/queries";
import JobCard from "./JobCard";

interface JobsTabProps {
  onViewClips?: (clipIds: number[]) => void;
}

export default function JobsTab({ onViewClips }: JobsTabProps) {
  const { data: jobs = [], isLoading, isError, refetch, isFetching } = useQuery<AgentJob[]>({
    queryKey: ["agentJobs"],
    queryFn:  getAgentJobs,
    refetchInterval: 10_000, // poll every 10s so in-progress jobs update
    staleTime: 5_000,
  });

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#F4F7EF]">Recent Jobs</h2>
          <p className="text-[13px] text-[#90A89C] mt-0.5">Last 50 agent jobs — auto-refreshes every 10 seconds</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] hover:text-[#B6FF4A] hover:border-[#39FF14]/40 hover:bg-[#084223] text-[13px] font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* States */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <p className="text-red-400 font-semibold">Failed to load jobs</p>
          <button onClick={() => refetch()} className="text-[#B6FF4A] text-sm underline">Try again</button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-[20px] bg-[#06351C] border border-[#0e4d2a] flex items-center justify-center">
            <BriefcaseBusiness className="w-8 h-8 text-[#90A89C]" />
          </div>
          <p className="text-[#F4F7EF] font-bold text-[16px]">No jobs yet</p>
          <p className="text-[#90A89C] text-[13px] max-w-xs">
            Hire an agent from the Agents tab to kick off your first AI clipping job.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onViewClips={onViewClips} />
          ))}
        </div>
      )}
    </div>
  );
}
