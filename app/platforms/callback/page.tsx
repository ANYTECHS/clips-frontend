"use client";

import React, { useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const handleCallback = async () => {
      const status = searchParams.get("status") ?? "error";
      const projectId = searchParams.get("projectId") ?? "";
      const platform = searchParams.get("platform") ?? "";
      const socialAccountIds = searchParams.get("socialAccountIds") ?? "";
      const error = searchParams.get("error") ?? undefined;

      try {
        await apiClient.post("/platforms/callback", {
          status,
          projectId,
          platform,
          socialAccountIds,
          error,
        });
        router.push("/platforms?connected=true");
      } catch (err) {
        console.error("Platform callback failed:", err);
        router.push("/platforms?error=true");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#020D08] flex flex-col items-center justify-center text-[#F4F7EF] p-6">
      <div className="w-full max-w-md bg-[#06351C] border border-[#0e4d2a] rounded-[32px] p-10 flex flex-col items-center text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#F4F7EF]">Connecting Account</h1>
          <p className="text-[#90A89C]">Please wait while we sync your social profile...</p>
        </div>
      </div>
    </div>
  );
}

export default function PlatformCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020D08] flex items-center justify-center text-[#F4F7EF]">
        <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
