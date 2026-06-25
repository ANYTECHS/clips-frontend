"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe, Shield, CheckCircle2, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/components/AuthProvider";
import { useWallet } from "@/components/WalletProvider";
import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";
import { buildBatchTransaction } from "@/app/lib/stellar";
import { createAddSignerOp, createMultisigThresholdsOp } from "@/app/lib/stellarOperations";
import { getStellarLabUrl, getStellarNetwork } from "@/app/lib/networkConfig";
import { useToast } from "@/hooks/useToast";

export default function MultisigPage() {
    const { user } = useAuth();
    const { address, walletType, isConnected } = useWallet();
    const { showToast } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sourcePublicKey, setSourcePublicKey] = useState("");
    const [signerPublicKey, setSignerPublicKey] = useState("");
    const [masterWeight, setMasterWeight] = useState(1);
    const [lowThreshold, setLowThreshold] = useState(1);
    const [medThreshold, setMedThreshold] = useState(2);
    const [highThreshold, setHighThreshold] = useState(2);

    const network = user?.walletNetwork ?? getStellarNetwork();
    const networkLabel = useMemo(
        () => (network === "mainnet" ? "Mainnet" : "Testnet"),
        [network]
    );

    useEffect(() => {
        if (address && walletType === "stellar") {
            setSourcePublicKey(address);
        }
    }, [address, walletType]);

    const {
        executeTransaction,
        status,
        isLoading,
        error,
        result,
        transactionHash,
        reset,
    } = useStellarTransaction({
        network,
        maxRetries: 3,
        onSuccess: () => {
            showToast("Multisig transaction submitted successfully", "success");
        },
        onError: (err) => {
            showToast(err.message, "error");
        },
    });

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!sourcePublicKey || !signerPublicKey) {
            showToast("Please provide both source account and signer public key.", "error");
            return;
        }

        const buildTransaction = async (): Promise<string> => {
            const signerOp = createAddSignerOp({
                ed25519PublicKey: signerPublicKey.trim(),
                weight: 1,
            });
            const thresholdOp = createMultisigThresholdsOp({
                lowThreshold,
                medThreshold,
                highThreshold,
                masterWeight,
            });

            const batch = await buildBatchTransaction(sourcePublicKey.trim(), [signerOp, thresholdOp], {
                memo: "Enable multisig",
            });

            if (!batch.ok) {
                throw new Error(batch.error.message);
            }

            return batch.xdr;
        };

        await executeTransaction(buildTransaction);
    };

    const explorerUrl = transactionHash
        ? getStellarLabUrl(transactionHash, network)
        : "";

    return (
        <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
            <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
            <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
                <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

                <div className="dashboard-main space-y-8 max-w-[920px] mx-auto w-full p-6 md:p-8">
                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground uppercase tracking-[0.3em] mb-2">
                                Wallet Security
                            </p>
                            <h1 className="text-3xl font-extrabold tracking-tight">Multisig Manager</h1>
                            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
                                Configure multisignature on your Stellar wallet by adding an extra signer and setting transaction thresholds.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
                            <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Setup multisig</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Use a second signer and higher thresholds to require multiple approvals before a transaction executes.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Network</p>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">{networkLabel}</div>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Default signer source</p>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                            {walletType === "stellar" && isConnected
                                                ? "Connected Stellar wallet"
                                                : "Enter a Stellar account public key"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface border border-white/5 rounded-2xl p-6">
                                <p className="text-sm font-semibold text-white mb-2">Quick links</p>
                                <div className="space-y-3">
                                    <Link
                                        href="/settings"
                                        className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-brand hover:bg-white/10 transition-colors"
                                    >
                                        Back to Wallet Settings
                                    </Link>
                                    <a
                                        href={explorerUrl || "https://www.stellar.org"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        {transactionHash ? "View last multisig tx" : "Stellar documentation"}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    Source account public key
                                    <input
                                        type="text"
                                        value={sourcePublicKey}
                                        onChange={(event) => setSourcePublicKey(event.target.value)}
                                        placeholder="G..."
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-brand"
                                        required
                                    />
                                </label>
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    Additional signer public key
                                    <input
                                        type="text"
                                        value={signerPublicKey}
                                        onChange={(event) => setSignerPublicKey(event.target.value)}
                                        placeholder="G..."
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-brand"
                                        required
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    Master weight
                                    <input
                                        type="number"
                                        min={0}
                                        value={masterWeight}
                                        onChange={(event) => setMasterWeight(Number(event.target.value))}
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-brand"
                                    />
                                </label>
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    Low threshold
                                    <input
                                        type="number"
                                        min={0}
                                        value={lowThreshold}
                                        onChange={(event) => setLowThreshold(Number(event.target.value))}
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-brand"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    Medium threshold
                                    <input
                                        type="number"
                                        min={0}
                                        value={medThreshold}
                                        onChange={(event) => setMedThreshold(Number(event.target.value))}
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-brand"
                                    />
                                </label>
                                <label className="space-y-2 text-sm text-muted-foreground">
                                    High threshold
                                    <input
                                        type="number"
                                        min={0}
                                        value={highThreshold}
                                        onChange={(event) => setHighThreshold(Number(event.target.value))}
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-brand"
                                    />
                                </label>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                                <p className="font-semibold text-white mb-2">Multisig guidance</p>
                                <p>
                                    The first signer is your current account. The second signer is an added
                                    public key that must also approve transactions once thresholds are raised.
                                </p>
                                <p className="mt-2">
                                    A common multisig setup is <strong>master weight 1 / med 2 / high 2</strong>.
                                    This means both signers are required for payments and account management.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-black transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Applying multisig
                                    </>
                                ) : (
                                    "Enable multisig"
                                )}
                            </button>
                        </div>
                    </form>

                    {status === "success" && transactionHash && (
                        <div className="bg-surface border border-white/10 rounded-2xl p-6">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 text-brand">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">Multisig transaction completed</p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Your multisig settings were submitted. You can review the transaction on Stellar Lab.
                                    </p>
                                    <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex items-center gap-2 text-sm text-brand hover:text-white"
                                    >
                                        View transaction <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === "error" && error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-red-400" />
                                <div>
                                    <p className="font-semibold text-white">Transaction failed</p>
                                    <p className="text-sm text-red-200 mt-2">{error.message}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
