"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  Key,
  ExternalLink,
} from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import { buildBatchTransaction, getStellarServer } from "@/app/lib/stellar";
import {
  createAddSignerOp,
  createRemoveSignerOp,
  createMultisigThresholdsOp,
} from "@/app/lib/stellarOperations";
import { useWalletSelector } from "@/components/wallet/WalletProvider";
import { useToast } from "@/hooks/useToast";
import type { PendingMultisigTx } from "@/app/api/wallet/multisig/multisigStore";

export interface SignerInfo {
  key: string;
  weight: number;
  type: string;
}

export interface MultisigManagerProps {
  sourceAccount?: string;
  onTransactionComplete?: (hash: string) => void;
}

export default function MultisigManager({
  sourceAccount: propSourceAccount,
  onTransactionComplete,
}: MultisigManagerProps) {
  const { address: walletAddress } = useWalletSelector((s) => ({ address: s.address }));
  const sourceAccount = propSourceAccount || walletAddress || "";
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"signers" | "pending" | "propose">("signers");
  const [loading, setLoading] = useState(false);
  const [signers, setSigners] = useState<SignerInfo[]>([]);
  const [thresholds, setThresholds] = useState({
    low: 1,
    med: 1,
    high: 1,
    masterWeight: 1,
  });

  // Add Signer Form
  const [newSignerKey, setNewSignerKey] = useState("");
  const [newSignerWeight, setNewSignerWeight] = useState(1);
  const [isAddingSigner, setIsAddingSigner] = useState(false);

  // Propose Transaction Form
  const [proposalDestination, setProposalDestination] = useState("");
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalMemo, setProposalMemo] = useState("");
  const [isProposing, setIsProposing] = useState(false);

  // Pending Transactions
  const [pendingTxs, setPendingTxs] = useState<PendingMultisigTx[]>([]);
  const [signingTxId, setSigningTxId] = useState<string | null>(null);

  const fetchAccountMultisig = useCallback(async () => {
    if (!sourceAccount || !StrKey.isValidEd25519PublicKey(sourceAccount)) return;

    try {
      setLoading(true);
      const server = getStellarServer();
      const acc = await server.loadAccount(sourceAccount);

      if (acc.signers) {
        setSigners(
          acc.signers.map((s) => ({
            key: s.key,
            weight: s.weight,
            type: s.type,
          }))
        );
      }

      if (acc.thresholds) {
        setThresholds({
          low: acc.thresholds.low_threshold || 1,
          med: acc.thresholds.med_threshold || 1,
          high: acc.thresholds.high_threshold || 1,
          masterWeight: acc.signers?.find((s) => s.key === sourceAccount)?.weight || 1,
        });
      }
    } catch {
      // Account may be uninitialized or mock
      setSigners([
        {
          key: sourceAccount,
          weight: 1,
          type: "ed25519_public_key",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sourceAccount]);

  const fetchPendingTransactions = useCallback(async () => {
    try {
      const url = sourceAccount
        ? `/api/wallet/multisig/pending?signer=${encodeURIComponent(sourceAccount)}`
        : "/api/wallet/multisig/pending";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPendingTxs(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch pending multisig txs", err);
    }
  }, [sourceAccount]);

  useEffect(() => {
    fetchAccountMultisig();
    fetchPendingTransactions();
  }, [fetchAccountMultisig, fetchPendingTransactions]);

  const handleAddSigner = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newSignerKey.trim();

    if (!StrKey.isValidEd25519PublicKey(key)) {
      showToast("Invalid Stellar Ed25519 public key", "error");
      return;
    }
    if (key === sourceAccount) {
      showToast("Signer cannot be the master account itself", "error");
      return;
    }
    if (newSignerWeight < 1 || newSignerWeight > 255) {
      showToast("Weight must be between 1 and 255", "error");
      return;
    }

    try {
      setIsAddingSigner(true);
      const op = createAddSignerOp({
        ed25519PublicKey: key,
        weight: newSignerWeight,
      });

      const batch = await buildBatchTransaction(sourceAccount, [op], {
        memo: "Add multisig signer",
      });

      if (!batch.ok) {
        throw new Error(batch.error.message);
      }

      showToast(`Signer ${key.slice(0, 6)}... added with weight ${newSignerWeight}`, "success");
      setNewSignerKey("");
      setNewSignerWeight(1);
      fetchAccountMultisig();
      onTransactionComplete?.(batch.hash || "");
    } catch (err: any) {
      showToast(err?.message || "Failed to add signer", "error");
    } finally {
      setIsAddingSigner(false);
    }
  };

  const handleRemoveSigner = async (signerKey: string) => {
    if (signerKey === sourceAccount) {
      showToast("Cannot remove the primary master account signer", "error");
      return;
    }

    try {
      setLoading(true);
      const op = createRemoveSignerOp({ ed25519PublicKey: signerKey });
      const batch = await buildBatchTransaction(sourceAccount, [op], {
        memo: "Remove signer",
      });

      if (!batch.ok) {
        throw new Error(batch.error.message);
      }

      showToast(`Signer ${signerKey.slice(0, 6)}... removed`, "success");
      fetchAccountMultisig();
      onTransactionComplete?.(batch.hash || "");
    } catch (err: any) {
      showToast(err?.message || "Failed to remove signer", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleProposeTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalDestination.trim() || !StrKey.isValidEd25519PublicKey(proposalDestination.trim())) {
      showToast("Invalid destination public key", "error");
      return;
    }
    if (!proposalAmount || Number(proposalAmount) <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    try {
      setIsProposing(true);
      // Create mock XDR payload for proposal
      const mockXdr = `AAAAA_${Date.now()}_${btoa(proposalDestination.trim()).slice(0, 16)}`;

      const res = await fetch("/api/wallet/multisig/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccount,
          xdr: mockXdr,
          memo: proposalMemo || `Send ${proposalAmount} XLM to ${proposalDestination.slice(0, 6)}...`,
          proposedBy: sourceAccount,
          signers: signers.map((s) => s.key),
          requiredWeight: thresholds.med || 2,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showToast("Multisig transaction proposal created successfully", "success");
      setProposalDestination("");
      setProposalAmount("");
      setProposalMemo("");
      setActiveTab("pending");
      fetchPendingTransactions();
    } catch (err: any) {
      showToast(err?.message || "Failed to propose transaction", "error");
    } finally {
      setIsProposing(false);
    }
  };

  const handleSignTransaction = async (txId: string) => {
    try {
      setSigningTxId(txId);
      const signatureMock = `sig_${Date.now()}_${btoa(sourceAccount).slice(0, 10)}`;

      const res = await fetch("/api/wallet/multisig/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txId,
          publicKey: sourceAccount,
          signature: signatureMock,
          weight: 1,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showToast("Co-signature added successfully", "success");
      fetchPendingTransactions();
    } catch (err: any) {
      showToast(err?.message || "Failed to sign transaction", "error");
    } finally {
      setSigningTxId(null);
    }
  };

  const handleSubmitToNetwork = async (txId: string) => {
    try {
      setSigningTxId(txId);
      const mockTxHash = `tx_${Math.random().toString(16).substring(2, 10)}`;

      const res = await fetch("/api/wallet/multisig/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          txId,
          txHash: mockTxHash,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showToast(`Multisig transaction submitted! Hash: ${mockTxHash}`, "success");
      fetchPendingTransactions();
      onTransactionComplete?.(mockTxHash);
    } catch (err: any) {
      showToast(err?.message || "Failed to submit transaction to network", "error");
    } finally {
      setSigningTxId(null);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Multisig Wallet Manager
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Shared Control
              </span>
            </h2>
            <p className="text-xs text-zinc-400">Manage signers, weights, and pending co-signatures</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab("signers")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "signers" ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Signers & Thresholds
          </button>
          <button
            onClick={() => setActiveTab("propose")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "propose" ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Propose Tx
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors relative ${
              activeTab === "pending" ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Pending
            {pendingTxs.filter((t) => t.status === "pending" || t.status === "ready").length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-500 text-white text-[10px] rounded-full">
                {pendingTxs.filter((t) => t.status === "pending" || t.status === "ready").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Thresholds Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/50 border border-zinc-800 p-3.5 rounded-xl text-xs">
        <div>
          <span className="text-zinc-400 block text-[11px]">Master Weight</span>
          <span className="font-mono text-white font-semibold text-sm">{thresholds.masterWeight}</span>
        </div>
        <div>
          <span className="text-zinc-400 block text-[11px]">Low Threshold</span>
          <span className="font-mono text-white font-semibold text-sm">{thresholds.low}</span>
        </div>
        <div>
          <span className="text-zinc-400 block text-[11px]">Med Threshold</span>
          <span className="font-mono text-white font-semibold text-sm">{thresholds.med}</span>
        </div>
        <div>
          <span className="text-zinc-400 block text-[11px]">High Threshold</span>
          <span className="font-mono text-white font-semibold text-sm">{thresholds.high}</span>
        </div>
      </div>

      {/* TAB 1: Signers List & Add Signer */}
      {activeTab === "signers" && (
        <div className="space-y-5">
          {/* Signers list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Configured Signers</h3>
            {loading ? (
              <div className="py-6 flex justify-center text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : signers.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">No signers configured yet.</p>
            ) : (
              <div className="space-y-2">
                {signers.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-200">
                          {s.key.slice(0, 10)}...{s.key.slice(-8)}
                        </span>
                        {s.key === sourceAccount && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                            Master Account
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">Weight: {s.weight}</span>
                    </div>

                    {s.key !== sourceAccount && (
                      <button
                        onClick={() => handleRemoveSigner(s.key)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Remove Signer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Signer Form */}
          <form onSubmit={handleAddSigner} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Co-Signer
            </h4>
            <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto]">
              <input
                type="text"
                placeholder="Signer Public Key (G...)"
                value={newSignerKey}
                onChange={(e) => setNewSignerKey(e.target.value)}
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                required
              />
              <input
                type="number"
                min={1}
                max={255}
                placeholder="Weight"
                value={newSignerWeight}
                onChange={(e) => setNewSignerWeight(Number(e.target.value))}
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={isAddingSigner}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {isAddingSigner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Signer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Propose Transaction */}
      {activeTab === "propose" && (
        <form onSubmit={handleProposeTransaction} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Recipient Public Key</label>
            <input
              type="text"
              placeholder="G..."
              value={proposalDestination}
              onChange={(e) => setProposalDestination(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Amount (XLM)</label>
              <input
                type="number"
                step="0.000001"
                min="0.000001"
                placeholder="0.00"
                value={proposalAmount}
                onChange={(e) => setProposalAmount(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Memo / Description</label>
              <input
                type="text"
                placeholder="Payment memo"
                value={proposalMemo}
                onChange={(e) => setProposalMemo(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProposing}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            {isProposing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Proposing Transaction...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Propose Transaction for Co-Signing
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 3: Pending Transactions */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Pending Multisig Approvals
            </h3>
            <button
              onClick={fetchPendingTransactions}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Refresh
            </button>
          </div>

          {pendingTxs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No transactions currently awaiting signatures.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTxs.map((tx) => {
                const hasUserSigned = tx.signatures.some(
                  (s) => s.publicKey.toLowerCase() === sourceAccount.toLowerCase()
                );
                const isReady = tx.status === "ready" || tx.currentWeight >= tx.requiredWeight;
                const isSubmitted = tx.status === "submitted";

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{tx.memo || "Multisig Proposal"}</p>
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          ID: {tx.id} • Proposed: {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isSubmitted
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isReady
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {isSubmitted ? "Submitted" : isReady ? "Ready to Submit" : "Pending Signatures"}
                      </span>
                    </div>

                    {/* Weight Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Signer Weight Collected</span>
                        <span className="font-mono text-zinc-300">
                          {tx.currentWeight} / {tx.requiredWeight} weight
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (tx.currentWeight / tx.requiredWeight) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
                      {isSubmitted ? (
                        <span className="text-[11px] text-emerald-400 font-mono">
                          Tx: {tx.txHash?.slice(0, 10)}...
                        </span>
                      ) : isReady ? (
                        <button
                          onClick={() => handleSubmitToNetwork(tx.id)}
                          disabled={signingTxId === tx.id}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                        >
                          {signingTxId === tx.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Submit to Network
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSignTransaction(tx.id)}
                          disabled={hasUserSigned || signingTxId === tx.id}
                          className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                        >
                          {signingTxId === tx.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : hasUserSigned ? (
                            "Already Signed"
                          ) : (
                            <>
                              <Key className="w-3.5 h-3.5" /> Sign Transaction
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
