"use client";

import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { getTransactionExplorerUrl } from "@/lib/wallet";

type TransactionStatus = "pending" | "confirmed" | "failed";

const statusStyles: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pending confirmation", className: "text-amber-300" },
  confirmed: { label: "Transaction confirmed", className: "text-[#B6FF4A]" },
  failed: { label: "Transaction failed", className: "text-red-400" },
};

export default function StellarTransactionStatus({
  status,
  hash,
}: {
  status: TransactionStatus;
  hash?: string;
}) {
  const statusInfo = statusStyles[status];
  const StatusIcon =
    status === "pending" ? Loader2 : status === "confirmed" ? CheckCircle2 : AlertCircle;

  return (
    <div className="w-full rounded-xl border border-[#0e4d2a] bg-[#042413] p-3 text-left">
      <div className={`flex items-center gap-2 text-[12px] font-bold ${statusInfo.className}`}>
        <StatusIcon className={`h-4 w-4 shrink-0 ${status === "pending" ? "animate-spin" : ""}`} />
        <span>{statusInfo.label}</span>
      </div>
      {hash && (
        <a
          href={getTransactionExplorerUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          title={hash}
          className="mt-2 flex items-center gap-1.5 break-all font-mono text-[10px] text-[#90A89C] hover:text-[#B6FF4A]"
        >
          <span>{hash}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      )}
    </div>
  );
}
