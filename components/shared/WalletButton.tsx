"use client";

import React, { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { connectStellarWallet, getConnectWalletChallenge, disconnectStellarWallet } from "@/lib/queries";
import { signAuthMessage, getWalletAddress } from "@/lib/wallet";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { getFriendlyErrorMessage } from "@/lib/formatError";

interface WalletButtonProps {
  className?: string;
  compact?: boolean;
  /** Responsive compact: hides label on mobile (<sm), visible on sm+ */
  responsiveCompact?: boolean;
  /** Called with the public key immediately after a successful wallet connect (login page use) */
  onConnect?: (address: string) => void;
  label?: string;
  linkingLabel?: string;
  connectedLabel?: string;
  iconClassName?: string;
}

function truncate(addr: string): string {
  if (addr.startsWith("G") && addr.length === 56) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletButton({
  className,
  compact = false,
  responsiveCompact = false,
  onConnect,
  label,
  linkingLabel,
  connectedLabel,
  iconClassName,
}: WalletButtonProps) {
  const { address, isConnecting, connect, openProfile, disconnect } = useWallet();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [linking, setLinking] = useState(false);

  const handleConnect = async () => {
    // Step 1 — open Freighter/wallet modal
    await connect();

    let addr: string;
    try {
      addr = await getWalletAddress();
    } catch {
      return;
    }

    if (user) {
      setLinking(true);
      try {
        const { challenge } = await getConnectWalletChallenge(addr);
        if (!challenge) {
          throw new Error("Could not get a challenge from the server.");
        }

        const nonceMatch = challenge.match(/nonce:\s*([^\n\r]+)/i);
        const nonce      = nonceMatch?.[1]?.trim() ?? "";

        if (!nonce) {
          throw new Error("Could not extract nonce from challenge.");
        }

        const rawSig = await signAuthMessage(challenge);
        const signature = rawSig.startsWith("ed25519:") ? rawSig.slice(8).trim() : rawSig.trim();

        const MAX_RETRIES = 4;
        let connected = false;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await connectStellarWallet(addr, signature, nonce);
            connected = true;
            break;
          } catch (postErr: any) {
            const status = postErr?.response?.status;
            const isServerWaking =
              status === 503 ||
              postErr?.code === "ERR_NETWORK" ||
              postErr?.message?.includes("503");

            if (isServerWaking && attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }
            throw postErr;
          }
        }

        if (!connected) throw new Error("Could not connect wallet after retries.");

        const apiClientMod = (await import("@/lib/apiClient")).default;
        const { data: updatedUser } = await apiClientMod.get("/users/me");
        setUser(updatedUser);

        toast("Wallet linked to your account!", "success");
      } catch (err: any) {
        const msg = getFriendlyErrorMessage(err, "Failed to link wallet. Please try again.");
        console.error("[WalletButton] Link failed:", err);
        toast(msg, "error");
        await disconnect();
      } finally {
        setLinking(false);
      }
    }

    onConnect?.(addr);
  };

  const handleDisconnect = async () => {
    try {
      try {
        await disconnectStellarWallet();
      } catch {
        // Backend disconnect may fail if already unlinked; proceed anyway
      }

      await openProfile();

      try {
        const apiClient = (await import("@/lib/apiClient")).default;
        const { data: updatedUser } = await apiClient.get("/users/me");
        setUser(updatedUser);
      } catch (meErr: any) {
        if (meErr?.response?.status === 401) {
          setUser(null);
        }
      }
    } catch (err) {
      console.error("Failed to disconnect wallet:", err);
    }
  };

  const busy = isConnecting || linking;
  const labelClass = compact ? "hidden" : responsiveCompact ? "hidden sm:inline" : "";

  if (address) {
    return (
      <button
        type="button"
        onClick={handleDisconnect}
        title={address}
        className={
          className ??
          "flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] bg-[#B6FF4A]/12 border border-[#B6FF4A]/30 text-[#B6FF4A] hover:bg-[#B6FF4A]/20 transition-all font-bold text-sm shadow-sm"
        }
      >
        <Wallet className={iconClassName ?? "w-4 h-4 shrink-0"} />
        <span className={`${labelClass} tabular-nums`}>{connectedLabel ?? truncate(address)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={busy}
      className={
        className ??
        "flex items-center justify-center gap-2 px-5 py-3 rounded-[14px] bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] hover:border-[#39FF14]/40 hover:bg-[#084223] transition-all font-bold text-sm disabled:opacity-60 shadow-sm"
      }
    >
      {busy ? (
        <Loader2 className={iconClassName ?? "w-4 h-4 animate-spin shrink-0 text-[#B6FF4A]"} />
      ) : (
        <Wallet className={iconClassName ?? "w-4 h-4 text-[#B6FF4A] shrink-0"} />
      )}
      <span className={labelClass}>
        {busy ? (linkingLabel ?? "Linking wallet…") : (label ?? "Connect Wallet")}
      </span>
    </button>
  );
}
