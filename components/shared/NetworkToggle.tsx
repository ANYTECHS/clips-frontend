"use client";

/**
 * NetworkToggle
 *
 * Lets a user switch the active Stellar network between Testnet and Mainnet.
 * Because Stellar wallets are non-custodial, the same keypair works on both
 * networks — switching does NOT require a new wallet, and the connected public
 * key is preserved across the switch (see WalletProvider.switchNetwork).
 *
 * A confirmation modal explains the implications before the switch is applied.
 */

import React, { useState } from "react";
import { ArrowLeftRight, ShieldCheck, Rocket } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import ConfirmModal from "@/components/shared/ConfirmModal";
import type { NetworkId } from "@/lib/wallet";

export default function NetworkToggle() {
  const { network, switchNetwork } = useWallet();
  const [pending, setPending] = useState<NetworkId | null>(null);

  const isMainnet = network === "mainnet";
  const target: NetworkId = isMainnet ? "testnet" : "mainnet";

  const title = isMainnet
    ? "Switch to Testnet"
    : "Switch to Mainnet";

  const message = isMainnet
    ? "You'll move back to the Stellar Testnet. This is safe to experiment with — no real funds are involved. Your wallet keys and connected address stay the same; the page will reload to apply the change."
    : "Switching to Mainnet uses real XLM and real transactions. Your wallet keys and connected address are preserved — no new wallet is needed. Make sure your wallet extension is set to Mainnet/Public and that your account is funded on mainnet, then confirm. The page will reload to apply the change.";

  const handleConfirm = () => {
    if (!pending) return;
    switchNetwork(pending);
    // switchNetwork() reloads the page, so we don't need to close the modal.
  };

  return (
    <>
      <div className="bg-[#06351C] backdrop-blur-md border border-[#0e4d2a] rounded-[20px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[#39FF14]/40 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#042413] border border-[#0e4d2a] flex items-center justify-center">
            {isMainnet ? (
              <Rocket className="w-5 h-5 text-[#B6FF4A]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#90A89C]" />
            )}
          </div>
          <div>
            <p className="font-bold text-[#F4F7EF] text-[14px]">Stellar Network</p>
            <p className="text-[11px] text-[#90A89C] leading-relaxed mt-0.5">
              Keys &amp; wallet are preserved across networks — no new wallet needed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              isMainnet
                ? "bg-[#B6FF4A]/15 border-[#B6FF4A]/30 text-[#B6FF4A]"
                : "bg-[#5A7A6B]/10 border-[#0e4d2a] text-[#90A89C]"
            }`}
          >
            {isMainnet ? "Mainnet" : "Testnet"}
          </span>
          <button
            type="button"
            onClick={() => setPending(target)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#042413] hover:bg-[#084223] border border-[#0e4d2a] hover:border-[#B6FF4A]/30 text-[#F4F7EF] hover:text-[#B6FF4A] text-xs font-bold transition-all active:scale-[0.98]"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Switch to {isMainnet ? "Testnet" : "Mainnet"}</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        title={title}
        message={message}
        confirmText={isMainnet ? "Switch to Testnet" : "Switch to Mainnet"}
        cancelText="Cancel"
        variant={isMainnet ? "info" : "danger"}
      />
    </>
  );
}
