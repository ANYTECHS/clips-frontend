"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ChevronDown, Loader2, Wallet } from "lucide-react";
import DashboardLayout from "@/components/shared/DashboardLayout";
import WalletButton from "@/components/shared/WalletButton";
import { useWallet } from "@/components/WalletProvider";
import { WalletPageSkeleton, TransactionListSkeleton } from "@/components/shared/SkeletonPresets";
import { getWalletTransactions } from "@/lib/queries";
import { getTransactionExplorerUrl } from "@/lib/wallet";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(date: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function WalletPage() {
  const { address, isConnecting, balances, balanceError } = useWallet();

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["walletTransactions"],
    queryFn: ({ pageParam }) => getWalletTransactions(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.cursor ? lastPage.cursor : undefined),
    retry: false,
  });

  if (isConnecting) {
    return (
      <DashboardLayout>
        <WalletPageSkeleton />
      </DashboardLayout>
    );
  }

  const transactions = data?.pages.flatMap((p) => p.items) ?? [];
  const xlm = balances.find((b) => b.assetCode === "XLM");

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F4F7EF]">Wallet</h1>
          <p className="mt-1 text-sm text-[#90A89C]">Your Stellar balance and transactions</p>
        </div>

        {/* Balance card */}
        <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B6FF4A]/12 border border-[#B6FF4A]/25 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#B6FF4A]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#F4F7EF]">Balance</p>
              <p className="text-xs text-[#90A89C] font-mono truncate">
                {address ? shortAddress(address) : "No wallet connected"}
              </p>
            </div>
          </div>

          {address ? (
            <>
              <p className="text-4xl font-extrabold text-[#F4F7EF] leading-10">
                {xlm ? Number(xlm.amount).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}{" "}
                <span className="text-base font-bold text-[#90A89C]">XLM</span>
              </p>
              <div className="flex flex-wrap gap-3 min-h-6">
                {balances
                  .filter((b) => b.assetCode !== "XLM")
                  .map((b) => (
                    <span
                      key={b.assetCode}
                      className="px-3 py-1 rounded-full bg-[#042413] border border-[#0e4d2a] text-xs font-bold text-[#F4F7EF]"
                    >
                      {Number(b.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {b.assetCode}
                    </span>
                  ))}
              </div>
              {balanceError && <p className="text-xs text-rose-400">{balanceError}</p>}
            </>
          ) : (
            <WalletButton className="min-h-11 px-4 rounded-xl bg-[#B6FF4A] text-[#020D08] font-bold text-sm" />
          )}
        </div>

        {/* Transactions */}
        {isLoading ? (
          <TransactionListSkeleton rows={5} />
        ) : (
          <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-[#0e4d2a]">
              <h2 className="text-base font-bold text-[#F4F7EF]">Transactions</h2>
            </div>
            {isError || transactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#90A89C]">
                {isError ? "Transactions could not be loaded." : "No transactions yet"}
              </p>
            ) : (
              <ul>
                {transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-4 p-4 border-b border-[#0e4d2a]/50 last:border-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4 text-[#B6FF4A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#F4F7EF] capitalize truncate">{tx.type}</p>
                      <p className="text-xs text-[#90A89C]">{formatDate(tx.createdAt)}</p>
                    </div>
                    {tx.txHash ? (
                      <a
                        href={getTransactionExplorerUrl(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 flex items-center text-sm font-bold text-[#B6FF4A] hover:underline shrink-0"
                      >
                        +{tx.amount} {tx.assetCode}
                      </a>
                    ) : (
                      <span className="text-sm font-bold text-[#B6FF4A] shrink-0">
                        +{tx.amount} {tx.assetCode}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex items-center gap-2 min-h-11 px-8 py-3 bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] rounded-xl font-bold hover:bg-[#084223] hover:border-[#39FF14]/40 transition-all disabled:opacity-50"
            >
              {isFetchingNextPage ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#B6FF4A]" />
              ) : (
                <>
                  Load more
                  <ChevronDown className="w-5 h-5 text-[#B6FF4A]" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
