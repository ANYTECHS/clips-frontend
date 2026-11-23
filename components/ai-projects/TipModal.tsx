"use client";

import React, { useEffect, useState } from "react";
import {
  X, Wallet, Download, Loader2,
  CheckCircle, AlertCircle, Sparkles,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { useToast } from "@/components/shared/ToastProvider";
import CopyButton from "@/components/shared/CopyButton";
import {
  getClipInfo,
  getClipDownloadUrl,
  buildTipTransaction,
  submitTipTransaction,
  type ClipInfo,
} from "@/lib/queries";
import { getTransactionHashFromXdr, signTransaction } from "@/lib/wallet";
import { markUnlocked } from "@/lib/tipUnlockStore";
import { isStepUpFresh } from "@/lib/stepUpAuth";
import StepUpModal from "@/components/auth/StepUpModal";
import { useAuth } from "@/components/AuthProvider";
import { getFriendlyErrorMessage } from "@/lib/formatError";
import StellarTransactionStatus from "@/components/shared/StellarTransactionStatus";

interface TipModalProps {
  clipId: string;
  clipTitle: string;
  onClose: () => void;
  onDownloadReady: (downloadUrl: string) => void;
}

type Step =
  | "loading"    // fetching clip info
  | "info"       // showing clip + tip details to the user
  | "building"   // POST /stellar/tips/build
  | "signing"    // waiting for Freighter signature
  | "submitting" // POST /stellar/tips/submit
  | "confirming" // polling getTipStatus until "confirmed"
  | "success"    // tip confirmed — triggering download
  | "error";

async function waitForDownload(
  clipId: string,
  senderAddress: string,
  maxAttempts = 15,
  delayMs = 2000,
): Promise<string> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { downloadUrl } = await getClipDownloadUrl(clipId, senderAddress);
      if (downloadUrl) return downloadUrl;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 402 && i < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    "Payment confirmation is taking longer than expected. Your tip was sent — try downloading again in a moment.",
  );
}

function truncateAddr(addr: string) {
  return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

function translateError(err: any): string {
  const status = err?.response?.status;
  const raw: string =
    err?.response?.data?.message || err?.message || "Something went wrong.";

  if (status === 503)
    return "The server is starting up. Please wait a moment and try again.";
  if (raw.toLowerCase().includes("sender account not found"))
    return "Your wallet has no XLM on the Stellar network. Fund it with at least 1 XLM to tip.";
  if (raw.toLowerCase().includes("insufficient"))
    return "Insufficient XLM balance. You need at least 1 XLM plus a small fee.";
  if (raw.toLowerCase().includes("destination account not found"))
    return "The creator's wallet doesn't exist on Stellar yet. Tips are unavailable for this clip.";
  if (raw.toLowerCase().includes("tx_too_late"))
    return "Transaction expired before it was submitted. Please try again.";
  if (raw.toLowerCase().includes("tx_bad_auth"))
    return "Signature mismatch — make sure Freighter is on the same network as the app and try again.";
  return getFriendlyErrorMessage(err, "Tip transaction failed. Please try again.");
}

export default function TipModal({
  clipId,
  clipTitle,
  onClose,
  onDownloadReady,
}: TipModalProps) {
  const { address, connect } = useWallet();
  const { toast }            = useToast();
  const { user }             = useAuth();
  const [showStepUp, setShowStepUp] = useState(false);

  const [step,       setStep]       = useState<Step>("loading");
  const [info,       setInfo]       = useState<ClipInfo | null>(null);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [txHash,     setTxHash]     = useState("");
  const [txStatus,   setTxStatus]   = useState<"pending" | "confirmed" | "failed" | null>(null);

  useEffect(() => {
    let active = true;
    setStep("loading");

    getClipInfo(clipId)
      .then((data) => {
        if (!active) return;
        setInfo(data);
        setStep("info");
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(translateError(err));
        setStep("error");
      });

    return () => { active = false; };
  }, [clipId]);

  const tipRequired = !!info?.owner?.stellarAddress;

  const handleAction = async () => {
    if (!tipRequired) {
      setStep("confirming");
      try {
        const { downloadUrl } = await getClipDownloadUrl(clipId);
        onDownloadReady(downloadUrl);
        onClose();
      } catch (err: any) {
        setErrorMsg(translateError(err));
        setStep("error");
      }
      return;
    }

    if (!address) {
      await connect();
      return;
    }

    // Issue #1366 — wallet sends require a step-up verification < 5 min old.
    if (!isStepUpFresh()) {
      setShowStepUp(true);
      return;
    }

    try {
      setTxHash("");
      setTxStatus(null);
      setStep("building");
      const buildRes = await buildTipTransaction(parseInt(clipId), "1", address);
      const targetXdr = (buildRes as any)?.transactionXdr || (buildRes as any)?.xdr;

      setStep("signing");
      const signedXdr = await signTransaction(targetXdr);

      setStep("submitting");
      const localTxHash = getTransactionHashFromXdr(signedXdr);
      setTxHash(localTxHash);
      setTxStatus("pending");
      try {
        const submission = await submitTipTransaction(parseInt(clipId), signedXdr, address);
        const submittedHash =
          submission?.txHash || submission?.transactionHash || submission?.hash || localTxHash;
        setTxHash(submittedHash);
      } catch (err) {
        setTxStatus("failed");
        throw err;
      }

      setStep("confirming");
      const downloadUrl = await waitForDownload(clipId, address);

      markUnlocked(clipId, address);
      setTxStatus("confirmed");
      setStep("success");
      toast("Tip confirmed! Download ready.", "success");

      await new Promise((r) => setTimeout(r, 1200));
      onDownloadReady(downloadUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(translateError(err));
      setStep("error");
    }
  };

  const stepLabel: Record<Step, string> = {
    loading:    "Loading…",
    info:       tipRequired ? "Tip to download" : "Free download",
    building:   "Building transaction…",
    signing:    "Waiting for wallet signature…",
    submitting: "Broadcasting to Stellar…",
    confirming: "Confirming on-chain…",
    success:    "Tip confirmed!",
    error:      "Something went wrong",
  };

  const isWorking = ["building", "signing", "submitting", "confirming", "success"].includes(step);
  const isBusy    = isWorking || step === "loading";

  const PROGRESS_STEPS: { id: Step; label: string }[] = [
    { id: "building",   label: "Build transaction" },
    { id: "signing",    label: "Sign with wallet"  },
    { id: "submitting", label: "Broadcast"         },
    { id: "confirming", label: "Confirm on-chain"  },
    { id: "success",    label: "Download ready"    },
  ];
  const currentProgressIdx = PROGRESS_STEPS.findIndex((s) => s.id === step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={!isBusy ? onClose : undefined}
    >
      <div
        className="relative w-full max-w-sm bg-[#06351C] border border-[#0e4d2a] rounded-[28px] shadow-[0_0_80px_rgba(57,255,20,0.12)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#0e4d2a]">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[#F4F7EF] text-[14px] font-extrabold truncate max-w-[220px]">
              {clipTitle}
            </p>
            <p className="text-[#90A89C] text-[11px] font-medium">{stepLabel[step]}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="w-8 h-8 rounded-full bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] hover:text-[#F4F7EF] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* Loading skeleton */}
          {step === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-[#B6FF4A] animate-spin" />
            </div>
          )}

          {/* Clip info card */}
          {(step === "info" || isWorking) && info && (
            <div className="bg-[#042413] border border-[#0e4d2a] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-[#B6FF4A] shrink-0" />
                <p className="text-[11px] font-bold text-[#90A89C] uppercase tracking-widest">
                  Creator wallet
                </p>
              </div>

              {info.owner.stellarAddress ? (
                <div className="flex items-start gap-2">
                  <p
                    className="text-[11px] font-mono text-[#B6FF4A] break-all leading-relaxed"
                    title={info.owner.stellarAddress}
                  >
                    {truncateAddr(info.owner.stellarAddress)}
                  </p>
                  <CopyButton
                    value={info.owner.stellarAddress}
                    label="Copy wallet address"
                    successMessage="Wallet address copied"
                    className="shrink-0 mt-0.5"
                  />
                </div>
              ) : (
                <p className="text-[12px] text-[#90A89C]">
                  No wallet connected — download is free.
                </p>
              )}

              {tipRequired && (
                <div className="flex items-center justify-between pt-2 border-t border-[#0e4d2a]">
                  <span className="text-[11px] text-[#90A89C] font-medium">Tip amount</span>
                  <span className="text-[14px] font-extrabold text-[#B6FF4A]">1 XLM</span>
                </div>
              )}
            </div>
          )}

          {/* Your wallet */}
          {(step === "info" || isWorking) && address && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#042413] border border-[#0e4d2a]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] shrink-0" />
              <span className="text-[10px] text-[#90A89C] font-medium">Your wallet:</span>
              <span className="text-[10px] font-mono text-[#F4F7EF]">{truncateAddr(address)}</span>
            </div>
          )}

          {/* Progress steps */}
          {isWorking && (
            <div className="space-y-2 pt-1">
              {PROGRESS_STEPS.map((s, idx) => {
                const isDone    = idx < currentProgressIdx;
                const isCurrent = idx === currentProgressIdx;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all
                      ${isDone    ? "bg-[#39FF14]" : ""}
                      ${isCurrent ? "bg-[#B6FF4A]/20 border border-[#B6FF4A]" : ""}
                      ${!isDone && !isCurrent ? "bg-[#042413] border border-[#0e4d2a]" : ""}
                    `}>
                      {isDone && <CheckCircle className="w-3 h-3 text-[#020D08]" />}
                      {isCurrent && <Loader2 className="w-3 h-3 text-[#B6FF4A] animate-spin" />}
                    </div>
                    <span className={`text-[12px] font-medium transition-colors
                      ${isDone    ? "text-[#B6FF4A]" : ""}
                      ${isCurrent ? "text-[#F4F7EF] font-bold" : ""}
                      ${!isDone && !isCurrent ? "text-[#90A89C]" : ""}
                    `}>
                      {s.label}
                    </span>
                    {isCurrent && s.id === "confirming" && (
                      <span className="text-[10px] text-[#90A89C] ml-auto">
                        waiting for Stellar…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {txStatus && step !== "success" && (isWorking || step === "error") && (
            <StellarTransactionStatus status={txStatus} hash={txHash || undefined} />
          )}

          {/* Success state */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <div className="absolute inset-0 blur-xl rounded-full bg-[#39FF14]/30 animate-pulse" />
                <div className="relative w-14 h-14 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/30 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-[#B6FF4A]" />
                </div>
              </div>
              <p className="text-[#F4F7EF] font-bold text-[14px]">Tip confirmed!</p>
              <p className="text-[#90A89C] text-[12px] text-center">
                Your download is starting…
              </p>
              <StellarTransactionStatus status="confirmed" hash={txHash || undefined} />
            </div>
          )}

          {/* Error state */}
          {step === "error" && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-400 font-medium leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        <div className="px-6 pb-6">
          {step === "error" ? (
            <button
              onClick={() => { setStep("info"); setErrorMsg(""); }}
              className="w-full py-3 rounded-2xl bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] text-[13px] font-bold hover:bg-[#084223] transition-colors"
            >
              Try again
            </button>
          ) : step === "success" ? (
            <div className="flex items-center justify-center gap-2 py-3 text-[#B6FF4A] text-[13px] font-bold">
              <Download className="w-4 h-4 animate-bounce" />
              Downloading…
            </div>
          ) : (
            <button
              onClick={handleAction}
              disabled={isBusy}
              className="w-full py-3.5 rounded-2xl bg-[#B6FF4A] text-[#020D08] text-[13px] font-black hover:bg-[#c6ff6b] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.25)]"
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#020D08]" />
              ) : tipRequired ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{tipRequired ? "Tip 1 XLM & Download" : "Download HD"}</span>
            </button>
          )}
        </div>
      </div>

      <StepUpModal
        isOpen={showStepUp}
        user={user}
        onClose={() => setShowStepUp(false)}
        onVerified={() => {
          setShowStepUp(false);
          void handleAction();
        }}
      />
    </div>
  );
}
