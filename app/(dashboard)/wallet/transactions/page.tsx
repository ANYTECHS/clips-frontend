"use client";

import React from "react";
import TransactionHistoryViewer from "@/components/wallet/TransactionHistoryViewer";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TransactionHistoryPage() {
  return (
    <div className="dashboard-main space-y-6 max-w-[900px] mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link
          href="/wallet"
          className="flex items-center gap-1.5 text-muted hover:text-white text-[13px] font-medium transition-colors"
          aria-label="Back to wallet"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Wallet
        </Link>
        <div>
          <h1 className="text-[28px] font-extrabold text-white tracking-tight">
            Transaction History
          </h1>
          <p className="text-muted text-[13px] mt-1">
            Your on-chain activity from MetaMask and Phantom wallets
          </p>
        </div>
      </div>

      <TransactionHistoryViewer />
    </div>
  );
}
