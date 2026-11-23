"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X, Bot, Link2, Loader2,
  Wallet, CreditCard, Zap,
  Upload, Film, Check, Sparkles, Gift,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { useAuth } from "@/components/AuthProvider";
import WalletButton from "@/components/shared/WalletButton";
import { useToast } from "@/components/shared/ToastProvider";
import {
  getTransactionHashFromXdr,
  signTransaction,
  submitToStellar,
  hasUsdcTrustline,
} from "@/lib/wallet";
import StellarTransactionStatus from "@/components/shared/StellarTransactionStatus";
import { uploadVideoToStorage, type StorageUploadResult, MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/uploadToStorage";
import {
  buildAgentPaymentXdr, hireAgent,
  buildSubscriptionPaymentXdr, activateSubscription,
  getMySubscription, checkUserHasEverClipped,
  type Agent, type AgentJob, type StellarSubscription,
} from "@/lib/queries";
import { markFreeJobAsClaimed, useFreeJobClaimed } from "@/lib/freeJobStore";
import apiClient from "@/lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveActiveJob } from "@/lib/processingStore";
import { isStepUpFresh } from "@/lib/stepUpAuth";
import StepUpModal from "@/components/auth/StepUpModal";
import { getFriendlyErrorMessage } from "@/lib/formatError";
import Button from "@/components/shared/Button";

interface HireAgentModalProps {
  agent: Agent;
  onClose: () => void;
  onJobCreated: (jobId: number) => void;
}

const STYLES = ["viral", "comedy", "funny", "normal"] as const;
type Style = typeof STYLES[number];

const PLANS = [
  { key: "STARTER" as const, label: "Starter",  price: "$9.99/mo",  jobs: "20 jobs/mo",  color: "border-[#0e4d2a]" },
  { key: "CREATOR" as const, label: "Creator",  price: "$24.99/mo", jobs: "60 jobs/mo",  color: "border-[#B6FF4A]/40" },
  { key: "PRO"     as const, label: "Pro",       price: "$49.99/mo", jobs: "150 jobs/mo", color: "border-purple-400/40" },
];

type PayMode    = "pay-per-job" | "subscription";
type Step       = "config" | "uploading" | "payment" | "signing" | "submitting" | "done" | "error";

export default function HireAgentModal({ agent, onClose, onJobCreated }: HireAgentModalProps) {
  const router        = useRouter();
  const { address }   = useWallet();
  const { user }      = useAuth();
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [style,          setStyle]          = useState<Style>("viral");
  const [payMode,        setPayMode]        = useState<PayMode>("pay-per-job");
  const [selPlan,        setSelPlan]        = useState<"STARTER" | "CREATOR" | "PRO">("CREATOR");
  const [step,           setStep]           = useState<Step>("config");
  const [errMsg,         setErrMsg]         = useState("");
  const [txHash,         setTxHash]         = useState("");
  const [txStatus,       setTxStatus]       = useState<"pending" | "confirmed" | "failed" | null>(null);
  // Issue #1366 — step-up re-verification before wallet payments.
  const [showStepUp,     setShowStepUp]     = useState(false);
  const pendingHireRef   = useRef<{ videoUrl: string; videoId?: string } | null>(null);

  const { data: subscription } = useQuery<StellarSubscription | null>({
    queryKey: ["mySubscription"],
    queryFn:  getMySubscription,
    staleTime: 30_000,
  });

  const { data: hasEverClipped = false, isLoading: checkingHistory } = useQuery<boolean>({
    queryKey: ["userHasEverClipped"],
    queryFn:  checkUserHasEverClipped,
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
    !checkingHistory &&
    !hasActiveSub &&
    !isClaimed &&
    !hasEverClipped;

  const canSubmit =
    (isFirstFreeJob ? (!!address || !!user) : !!address) &&
    !!selectedFile;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|avi|webm|mkv)$/i.test(file.name)) {
        toast("Please select a valid video file (MP4, MOV, AVI, WEBM, or MKV).", "error");
        return;
      }
      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        toast("File size exceeds 1GB limit. Please upload a smaller video.", "error");
        return;
      }
      setSelectedFile(file);
    }
  };

  const runHireFlow = async (videoUrl: string, uploadedVideoId?: string) => {
    try {
      // Issue #1366 — any wallet payment requires a step-up verification
      // no older than 5 minutes (mirrors UserSession.stepUpVerified on the API).
      const willPay =
        !(isFirstFreeJob && payMode === "pay-per-job") &&
        !(payMode === "subscription" && hasActiveSub);
      if (willPay && !isStepUpFresh()) {
        pendingHireRef.current = { videoUrl, videoId: uploadedVideoId };
        setShowStepUp(true);
        return;
      }

      setTxHash("");
      setTxStatus(null);

      if (isFirstFreeJob && payMode === "pay-per-job") {
        setStep("submitting");

        markFreeJobAsClaimed([user?.id, user?.email, address]);

        const freeJobRes = await apiClient.post("/stellar/agent/free-hire", {
          agentId: agent.id,
          videoUrl,
          style,
          userAddress: address || undefined,
        });

        const jobId = freeJobRes.data?.jobId || freeJobRes.data?.id;
        const assignedVideoId =
          freeJobRes.data?.videoId ||
          uploadedVideoId ||
          (jobId ? String(jobId) : null);

        if (assignedVideoId) {
          saveActiveJob(assignedVideoId);
        }

        queryClient.invalidateQueries({ queryKey: ["userHasEverClipped"] });
        queryClient.invalidateQueries({ queryKey: ["userClipCount"] });
        queryClient.invalidateQueries({ queryKey: ["userVideoCount"] });

        setStep("done");
        toast("Free welcome job started successfully! 🚀", "success");

        setTimeout(() => {
          onJobCreated(jobId);
          if (assignedVideoId) {
            router.push(`/dashboard/processing?videoId=${assignedVideoId}`);
          }
        }, 1200);
        return;
      }

      if (payMode === "subscription" && !hasActiveSub) {
        setStep("payment");
        const subRes = await buildSubscriptionPaymentXdr({
          senderAddress: address!,
          plan: selPlan,
        });

        setStep("signing");
        const signedSubXdr = await signTransaction(subRes.xdr);

        setStep("submitting");
        const localTxHash = getTransactionHashFromXdr(signedSubXdr);
        setTxHash(localTxHash);
        setTxStatus("pending");
        try {
          const submittedHash = await submitToStellar(signedSubXdr);
          setTxHash(submittedHash);
          setTxStatus("confirmed");
        } catch (err) {
          setTxStatus("failed");
          throw err;
        }

        await activateSubscription({
          senderAddress: address!,
          plan: selPlan,
          signedXdr: signedSubXdr,
        });
        queryClient.invalidateQueries({ queryKey: ["mySubscription"] });
      }

      let txHash: string | undefined;

      if (!hasActiveSub && !(payMode === "subscription")) {
        const hasTrustline = await hasUsdcTrustline(address!);
        if (!hasTrustline) {
          throw new Error(
            "Your wallet does not have a USDC trustline. Please add USDC in your Freighter wallet before hiring an agent."
          );
        }

        setStep("payment");
        const paymentRes = await buildAgentPaymentXdr({
          senderAddress: address!,
          videoUrl,
          style,
        });

        setStep("signing");
        const signedPaymentXdr = await signTransaction(paymentRes.xdr);

        setStep("submitting");
        const localTxHash = getTransactionHashFromXdr(signedPaymentXdr);
        setTxHash(localTxHash);
        setTxStatus("pending");
        try {
          txHash = await submitToStellar(signedPaymentXdr);
          setTxHash(txHash);
          setTxStatus("confirmed");
        } catch (err) {
          setTxStatus("failed");
          throw err;
        }
      }

      setStep("submitting");
      const job: AgentJob = await hireAgent({
        videoUrl,
        senderAddress: address!,
        style,
        ...(txHash ? { signedXdr: txHash } : {}),
      });

      markFreeJobAsClaimed([user?.id, user?.email, address]);

      const assignedVideoId =
        (job as any)?.videoId ||
        uploadedVideoId ||
        (job?.id ? String(job.id) : null);

      if (assignedVideoId) {
        saveActiveJob(assignedVideoId);
      }

      queryClient.invalidateQueries({ queryKey: ["userHasEverClipped"] });
      queryClient.invalidateQueries({ queryKey: ["userClipCount"] });
      queryClient.invalidateQueries({ queryKey: ["userVideoCount"] });

      setStep("done");
      toast("Job started successfully!", "success");

      setTimeout(() => {
        onJobCreated(job.id);
        if (assignedVideoId) {
          router.push(`/dashboard/processing?videoId=${assignedVideoId}`);
        }
      }, 1200);

    } catch (err: any) {
      console.error("[HireAgentModal] Error:", err);
      const msg = getFriendlyErrorMessage(err, "Failed to start agent job.");
      setErrMsg(msg);
      setStep("error");
      toast(msg, "error");
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast("Please select a video file.", "error");
      return;
    }

    setErrMsg("");
    setStep("uploading");
    setUploadProgress(0);

    try {
      const uploadResult: StorageUploadResult = await uploadVideoToStorage(
        selectedFile,
        (progress) => setUploadProgress(progress)
      );

      let videoId = uploadResult.videoId;

      if (!videoId) {
        try {
          const regRes = await apiClient.post("/videos/register", {
            url: uploadResult.url,
            title: selectedFile.name.replace(/\.[^/.]+$/, ""),
          });
          videoId = regRes.data?.id ? String(regRes.data.id) : undefined;
        } catch (regErr) {
          console.warn("[HireAgentModal] Video registration endpoint error (proceeding with URL):", regErr);
        }
      }

      await runHireFlow(uploadResult.url, videoId);
    } catch (err: any) {
      console.error("[HireAgentModal] Upload error:", err);
      const msg = getFriendlyErrorMessage(err, "Failed to upload video.");
      setErrMsg(msg);
      setStep("error");
      toast(msg, "error");
    }
  };

  const isBusy =
    step === "uploading" ||
    step === "payment"   ||
    step === "signing"   ||
    step === "submitting" ||
    step === "done";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={!isBusy ? onClose : undefined}
      />

      <div className="relative w-full max-w-lg bg-[#06351C] border border-[#0e4d2a] rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#39FF14]/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="flex items-center justify-between p-6 border-b border-[#0e4d2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[#B6FF4A]" />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#F4F7EF]">Hire Agent</h2>
              <p className="text-[11px] text-[#90A89C]">{agent.name}</p>
            </div>
          </div>
          <button
            onClick={!isBusy ? onClose : undefined}
            disabled={isBusy}
            className="p-2 rounded-xl text-[#90A89C] hover:text-[#F4F7EF] hover:bg-[#042413] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {step === "config" && (
            <>
              {/* Wallet status / Free Welcome status */}
              {isFirstFreeJob ? (
                <div className="p-4 rounded-[18px] bg-gradient-to-r from-[#00C853]/20 via-[#042413] to-[#06351C] border border-[#00C853]/35 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_12px_rgba(57,255,20,0.2)]">
                      <Sparkles className="w-4 h-4 text-[#B6FF4A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-extrabold text-[#F4F7EF]">First Agent Job is 100% Free!</p>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#B6FF4A] text-[#020D08] uppercase tracking-wider">
                          Welcome Credit
                        </span>
                      </div>
                      <p className="text-[12px] text-[#90A89C] mt-1 leading-relaxed">
                        As a new creator, your first video clipping job is completely free—no 0.50 USDC fee or wallet payment required.
                      </p>
                    </div>
                  </div>
                  {user?.email && (
                    <div className="flex items-center justify-between pt-1 text-[11px] text-[#90A89C] font-mono border-t border-[#0e4d2a]">
                      <span className="flex items-center gap-1.5 text-[#B6FF4A]">
                        <Check className="w-3.5 h-3.5" /> Account: {user.email}
                      </span>
                      <span className="text-[10px] text-[#B6FF4A] font-bold uppercase tracking-wider">
                        Free Trial Active
                      </span>
                    </div>
                  )}
                  {address && !user?.email && (
                    <div className="flex items-center justify-between pt-1 text-[11px] text-[#90A89C] font-mono border-t border-[#0e4d2a]">
                      <span className="flex items-center gap-1.5 text-[#B6FF4A]">
                        <Check className="w-3.5 h-3.5 text-[#B6FF4A]" /> Wallet linked: {address.slice(0, 6)}…{address.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              ) : !address ? (
                <div className="p-4 rounded-[18px] bg-[#042413] border border-amber-400/25 shadow-[0_4px_20px_rgba(0,0,0,0.3)] space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Wallet className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-[#F4F7EF]">Stellar Wallet Required</p>
                        {user?.email && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#06351C] text-[#90A89C] border border-[#0e4d2a] truncate max-w-[170px]"
                            title={user.email}
                          >
                            {user.email}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#90A89C] mt-1 leading-relaxed">
                        To hire this agent for paid clipping jobs ($0.50 USDC), connect your Stellar wallet (Freighter, Lobstr) to sign transactions.
                      </p>
                    </div>
                  </div>

                  <WalletButton
                    label="Add Wallet to Pay"
                    linkingLabel="Linking Wallet…"
                    iconClassName="w-4 h-4 text-[#020D08] shrink-0"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[14px] bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black text-[13px] transition-all shadow-[0_0_20px_rgba(57,255,20,0.25)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 rounded-[16px] bg-[#042413] border border-[#0e4d2a]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-[#B6FF4A]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[10px] font-extrabold text-[#B6FF4A] uppercase tracking-wider">Wallet Connected</p>
                        {user?.email && (
                          <span className="text-[10px] text-[#90A89C] truncate">({user.email})</span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#F4F7EF] font-mono truncate">{address}</p>
                    </div>
                  </div>
                  <WalletButton
                    compact
                    connectedLabel="Change"
                    className="text-[11px] text-[#90A89C] hover:text-[#F4F7EF] transition-colors px-2.5 py-1.5 rounded-lg border border-[#0e4d2a] hover:border-[#39FF14]/40 hover:bg-[#06351C] shrink-0"
                  />
                </div>
              )}
              <div className="space-y-3">
                <label className="text-[12px] font-bold text-[#90A89C] uppercase tracking-wider">
                  Video Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] border border-[#B6FF4A]/40 bg-[#042413] text-[#F4F7EF] select-none">
                    <Upload className="w-4 h-4 shrink-0 text-[#B6FF4A]" />
                    <div>
                      <p className="text-[13px] font-bold leading-tight">Upload File</p>
                      <p className="text-[10px] text-[#B6FF4A]/80 mt-0.5">MP4, MOV, WEBM</p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] border border-[#0e4d2a] bg-[#042413]/50 text-[#5A7A6B] cursor-not-allowed select-none opacity-50 relative"
                    title="URL upload is disabled on Hire Agent"
                  >
                    <Link2 className="w-4 h-4 shrink-0 text-[#5A7A6B]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-bold leading-tight text-[#90A89C]">Video URL</p>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#06351C] text-[#90A89C]">Disabled</span>
                      </div>
                      <p className="text-[10px] text-[#5A7A6B] mt-0.5 truncate">Upload file directly</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-[20px] p-6 flex flex-col items-center gap-3 transition-all group ${
                    selectedFile
                      ? "border-[#B6FF4A]/50 bg-[#042413]"
                      : "border-[#0e4d2a] bg-[#042413] hover:border-[#39FF14]/40 hover:bg-[#084223]"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
                    selectedFile
                      ? "bg-[#B6FF4A]/15 border-[#B6FF4A]/40"
                      : "bg-[#031d0f] border-[#0e4d2a] group-hover:border-[#39FF14]/40"
                  }`}>
                    {selectedFile
                      ? <Check className="w-5 h-5 text-[#B6FF4A]" />
                      : <Upload className="w-5 h-5 text-[#90A89C] group-hover:text-[#B6FF4A] transition-colors" />
                    }
                  </div>
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-[#F4F7EF] truncate max-w-[260px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-[#90A89C] mt-0.5">
                        {selectedFile.size >= 1000 * 1024 * 1024
                          ? `${(selectedFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}{" "}
                        · Click to change
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-[#F4F7EF]">Click to select video file</p>
                      <p className="text-[11px] text-[#90A89C] mt-0.5">MP4, MOV, WEBM up to 1 GB</p>
                    </div>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#90A89C] uppercase tracking-wider">Clip Style</label>
                <div className="grid grid-cols-4 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`py-2.5 rounded-[12px] text-[12px] font-bold capitalize border transition-all ${
                        style === s
                          ? "bg-[#B6FF4A] text-[#020D08] font-black border-[#B6FF4A] shadow-[0_0_12px_rgba(57,255,20,0.25)]"
                          : "bg-[#042413] border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF] hover:border-[#39FF14]/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[12px] font-bold text-[#90A89C] uppercase tracking-wider">Payment</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPayMode("pay-per-job")}
                    className={`p-4 rounded-[16px] border text-left transition-all ${
                      payMode === "pay-per-job"
                        ? "bg-[#042413] border-[#B6FF4A]/40 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                        : "bg-[#042413] border-[#0e4d2a] hover:border-[#39FF14]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {isFirstFreeJob ? (
                        <Gift className="w-5 h-5 text-[#B6FF4A]" />
                      ) : (
                        <CreditCard className={`w-5 h-5 ${payMode === "pay-per-job" ? "text-[#B6FF4A]" : "text-[#5A7A6B]"}`} />
                      )}
                      {isFirstFreeJob && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#B6FF4A] text-[#020D08] text-[9px] font-black uppercase tracking-wider">
                          FREE
                        </span>
                      )}
                    </div>
                    <p className={`text-[13px] font-bold ${payMode === "pay-per-job" ? "text-[#F4F7EF]" : "text-[#90A89C]"}`}>
                      {isFirstFreeJob ? "1st Job Free" : "Pay per Job"}
                    </p>
                    <p className="text-[11px] text-[#90A89C] mt-0.5">
                      {isFirstFreeJob ? (
                        <span className="text-[#B6FF4A] font-bold">
                          $0.00 USDC <span className="line-through text-[#90A89C] text-[10px] ml-1 font-normal">$0.50</span>
                        </span>
                      ) : (
                        "$0.50 USDC / job"
                      )}
                    </p>
                  </button>
                  <button
                    onClick={() => setPayMode("subscription")}
                    className={`p-4 rounded-[16px] border text-left transition-all ${
                      payMode === "subscription"
                        ? "bg-[#042413] border-[#B6FF4A]/40 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                        : "bg-[#042413] border-[#0e4d2a] hover:border-[#39FF14]/40"
                    }`}
                  >
                    <Zap className={`w-5 h-5 mb-2 ${payMode === "subscription" ? "text-[#B6FF4A]" : "text-[#5A7A6B]"}`} />
                    <p className={`text-[13px] font-bold ${payMode === "subscription" ? "text-[#F4F7EF]" : "text-[#90A89C]"}`}>
                      {hasActiveSub ? "Use Subscription" : "Subscribe"}
                    </p>
                    <p className="text-[11px] text-[#90A89C] mt-0.5">
                      {hasActiveSub ? `${subscription?.plan} plan active` : "From $9.99/mo"}
                    </p>
                  </button>
                </div>

                {/* Plan picker — only shown when subscribing fresh */}
                {payMode === "subscription" && !hasActiveSub && (
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setSelPlan(p.key)}
                        className={`p-3 rounded-[14px] border text-center transition-all ${
                          selPlan === p.key
                            ? `bg-[#042413] ${p.color} border-[#B6FF4A]/50`
                            : "bg-[#042413] border-[#0e4d2a] hover:border-[#39FF14]/40"
                        }`}
                      >
                        <p className={`text-[13px] font-bold ${selPlan === p.key ? "text-[#F4F7EF]" : "text-[#90A89C]"}`}>
                          {p.label}
                        </p>
                        <p className="text-[11px] text-[#B6FF4A] font-bold mt-0.5">{p.price}</p>
                        <p className="text-[10px] text-[#90A89C] mt-0.5">{p.jobs}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button size="lg" onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full"
              >
                {isFirstFreeJob && payMode === "pay-per-job"
                  ? selectedFile
                    ? "Upload & Generate Free Clip ✨"
                    : "Select a Video File to Generate Free Clip ✨"
                  : !address
                  ? "Connect Wallet to Hire"
                  : selectedFile
                  ? payMode === "pay-per-job"
                    ? "Upload & Pay $0.50 USDC"
                    : hasActiveSub
                    ? "Upload & Use Subscription"
                    : `Upload & Subscribe (${PLANS.find((p) => p.key === selPlan)?.price})`
                  : payMode === "pay-per-job"
                  ? "Pay $0.50 USDC & Hire"
                  : hasActiveSub
                  ? "Use Subscription & Hire"
                  : `Subscribe (${PLANS.find((p) => p.key === selPlan)?.price}) & Hire`}
              </Button>
            </>
          )}
          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-5 text-center">
              <div className="w-14 h-14 rounded-[20px] bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 flex items-center justify-center">
                <Film className="w-7 h-7 text-[#B6FF4A]" />
              </div>
              <div className="space-y-1">
                <p className="text-[#F4F7EF] font-bold text-[16px]">Uploading video…</p>
                <p className="text-[#90A89C] text-[13px]">
                  {uploadProgress > 0 ? `${uploadProgress}%` : "Starting upload…"}
                </p>
              </div>
              <div className="w-full max-w-xs h-2 bg-[#020D08] rounded-full overflow-hidden border border-[#0e4d2a]">
                <div
                  className="h-full bg-[#39FF14] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(57,255,20,0.6)]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#90A89C]">Do not close this window</p>
            </div>
          )}
          {(step === "payment" || step === "signing" || step === "submitting") && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <Loader2 className="w-12 h-12 text-[#B6FF4A] animate-spin" />
              <p className="text-[#F4F7EF] font-bold text-[16px]">
                {step === "payment"
                  ? "Building transaction…"
                  : step === "signing"
                  ? "Waiting for wallet signature…"
                  : isFirstFreeJob
                  ? "Activating your free agent job…"
                  : "Submitting to Stellar network…"}
              </p>
              <p className="text-[#90A89C] text-[13px] max-w-xs leading-relaxed">
                {step === "signing"
                  ? "Please confirm the transaction in your Stellar wallet (Freighter, Lobstr, etc.)"
                  : step === "submitting"
                  ? isFirstFreeJob
                    ? "Initializing AI clipping with your welcome credit…"
                    : "Broadcasting your USDC payment to the Stellar network…"
                  : "Preparing your USDC payment on the Stellar network…"}
              </p>
              {txStatus && <StellarTransactionStatus status={txStatus} hash={txHash || undefined} />}
            </div>
          )}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 flex items-center justify-center">
                <Check className="w-7 h-7 text-[#B6FF4A]" />
              </div>
              <p className="text-[#F4F7EF] font-bold text-[16px]">Job Started!</p>
              <p className="text-[#90A89C] text-[13px]">Your AI agent has begun processing clips.</p>
              {txStatus && <StellarTransactionStatus status={txStatus} hash={txHash || undefined} />}
            </div>
          )}
          {step === "error" && (
            <div className="py-6 space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1">
                <p className="text-[#F4F7EF] font-bold text-[15px]">Failed to start job</p>
                <p className="text-[#90A89C] text-[12px] max-w-sm mx-auto leading-relaxed">
                  {errMsg || "An unexpected error occurred. Please try again."}
                </p>
                {txStatus && <StellarTransactionStatus status={txStatus} hash={txHash || undefined} />}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("config")}
                  className="flex-1 py-3 rounded-[14px] bg-[#042413] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] font-bold text-[13px] transition-all"
                >
                  Back
                </button>
                <Button onClick={handleSubmit}
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      <StepUpModal
        isOpen={showStepUp}
        user={user}
        onClose={() => {
          setShowStepUp(false);
          pendingHireRef.current = null;
        }}
        onVerified={() => {
          setShowStepUp(false);
          const pending = pendingHireRef.current;
          pendingHireRef.current = null;
          if (pending) void runHireFlow(pending.videoUrl, pending.videoId);
        }}
      />
    </div>
  );
}
