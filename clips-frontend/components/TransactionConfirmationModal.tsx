"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "./WalletProvider";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { buildPaymentTransaction } from "@/app/lib/stellar";

interface TransactionConfirmationModalProps {
  recipient: string;
  amount: string;
  memo?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransactionConfirmationModal({
  recipient,
  amount,
  memo = "",
  onClose,
  onSuccess,
}: TransactionConfirmationModalProps) {
  const { sendXlmPayment, address } = useWallet();

  const [step, setStep] = useState<"calculating" | "confirm" | "submitting" | "success" | "error">(
    "calculating"
  );
  const [fee, setFee] = useState("0.0001"); // Default minimum Stellar fee
  const [totalCost, setTotalCost] = useState("");
  const [txHash, setTxHash] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

  // Calculate fees on load
  useEffect(() => {
    async function calculateFees() {
      if (!address) return;
      try {
        const { fee: calculatedFee } = await buildPaymentTransaction(address, recipient, amount);
        setFee(calculatedFee);
        const total = (parseFloat(amount) + parseFloat(calculatedFee)).toFixed(6);
        setTotalCost(total);
        setStep("confirm");
      } catch (err: any) {
        console.error("Fee calculation error:", err);
        setErrorMessage(err.message || "Failed to load transaction details. Account may be unfunded.");
        setStep("error");
      }
    }

    calculateFees();
  }, [address, recipient, amount]);

  const handleConfirmSubmit = async () => {
    setStep("submitting");
    setErrorMessage("");
    try {
      const result = await sendXlmPayment(recipient, amount);
      if (result.success && result.hash) {
        setTxHash(result.hash);
        setStep("success");
        // Trigger confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#00e58f", "#ffffff", "#10b981", "#059669"],
        });
      } else {
        throw new Error("Transaction submission did not return a valid hash.");
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      setErrorMessage(err.message || "Transaction failed. Please check network and try again.");
      setStep("error");
    }
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStellarExpertUrl = () => {
    const netPath = network === "mainnet" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${netPath}/tx/${txHash}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md animate-in fade-in duration-300"
        onClick={step !== "submitting" ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#090E0C] border border-white/10 rounded-[28px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand" />
            <h4 className="font-extrabold text-white text-base">Stellar Transaction</h4>
          </div>
          {step !== "submitting" && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content steps */}
        <div className="p-6">
          {step === "calculating" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-brand" />
              <div>
                <p className="text-sm font-bold text-white">Preparing Transaction...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Loading sequence numbers and calculating base network fees.
                </p>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-6">
              <div className="text-center bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Sending</span>
                <h2 className="text-3xl font-black text-brand tracking-tight mt-1">
                  {amount} <span className="text-white text-lg font-bold">XLM</span>
                </h2>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[10px] text-brand uppercase font-bold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  Stellar {network}
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="flex justify-between items-start text-sm">
                  <span className="text-muted-foreground font-semibold">Recipient</span>
                  <span className="font-mono text-white text-right break-all max-w-[240px] text-xs">
                    {recipient}
                  </span>
                </div>
                
                {memo && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-semibold">Memo</span>
                    <span className="text-white text-right max-w-[240px] truncate font-medium">
                      {memo}
                    </span>
                  </div>
                )}

                <div className="h-px bg-white/5 my-2" />

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-semibold">Network Fee</span>
                  <span className="font-mono text-white font-medium">{fee} XLM</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-white font-bold">Total Cost</span>
                  <span className="font-mono text-brand font-black text-base">{totalCost || (parseFloat(amount) + 0.0001).toFixed(4)} XLM</span>
                </div>
              </div>

              <button
                onClick={handleConfirmSubmit}
                className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(0,229,143,0.15)]"
              >
                <span>Confirm & Submit Transaction</span>
              </button>
            </div>
          )}

          {step === "submitting" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border border-brand/20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                </div>
                <div className="absolute inset-0 w-12 h-12 rounded-full border-t border-brand animate-ping opacity-30" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Submitting to Stellar Network...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Signing with local keypair and broadcasting to Horizon nodes.
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-4 text-emerald-400">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-white">Payment Successful</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Your transaction has been written to the Stellar ledger and finalized.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">Sent Amount</span>
                  <span className="text-brand font-black font-mono">{amount} XLM</span>
                </div>

                <div className="flex justify-between items-start text-xs">
                  <span className="text-muted-foreground font-semibold">Tx Hash</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono truncate max-w-[160px] text-[11px]">
                      {txHash}
                    </span>
                    <button
                      onClick={handleCopyHash}
                      className="p-1 hover:bg-white/5 rounded text-muted-foreground hover:text-white transition-colors cursor-pointer"
                      title="Copy transaction hash"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={getStellarExpertUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3.5 rounded-xl border border-white/10 hover:border-brand/35 text-white hover:text-brand text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer bg-white/[0.01]"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-black text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4 text-red-400">
                  <XCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-white">Transaction Failed</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  An error occurred while building, signing, or broadcasting your transaction.
                </p>
              </div>

              <div className="bg-red-950/20 border border-red-500/15 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed break-words max-w-[280px]">
                  {errorMessage}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep("calculating")}
                  className="flex-1 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-black text-xs font-bold transition-all cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
