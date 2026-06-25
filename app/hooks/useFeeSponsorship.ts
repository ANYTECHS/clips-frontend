"use client";

import { useState, useCallback, useEffect } from "react";
import { getStellarNetwork } from "@/app/lib/networkConfig";
import {
  getSponsorBalance,
  hasSufficientSponsorBalance,
  estimateSponsoredFee,
} from "@/app/lib/feeSponsorship";

export type SponsorshipStatus =
  | "checking"
  | "available"
  | "insufficient_balance"
  | "unavailable"
  | "error";

export interface FeeSponsorshipState {
  status: SponsorshipStatus;
  sponsorBalance: string | null;
  estimatedFee: {
    totalOps: number;
    baseFeeStroops: number;
    totalFeeStroops: number;
    totalFeeXLM: string;
  } | null;
  error: string | null;
}

const DEFAULT_SPONSOR_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SPONSOR_PUBLIC_KEY ?? "";

/**
 * Hook to check and monitor fee sponsorship availability.
 *
 * The platform sets `NEXT_PUBLIC_SPONSOR_PUBLIC_KEY` in env variables.
 * If this is not set, fee sponsorship is considered unavailable.
 *
 * @example
 * ```tsx
 * const { status, sponsorBalance, estimatedFee } = useFeeSponsorship();
 *
 * if (status === "available") {
 *   // Show "Fee sponsored by platform" badge
 * }
 * ```
 */
export function useFeeSponsorship(operationCount: number = 1) {
  const [state, setState] = useState<FeeSponsorshipState>({
    status: "checking",
    sponsorBalance: null,
    estimatedFee: null,
    error: null,
  });

  const checkSponsorship = useCallback(async () => {
    // If no sponsor key is configured, sponsorship is unavailable
    if (!DEFAULT_SPONSOR_PUBLIC_KEY) {
      setState({
        status: "unavailable",
        sponsorBalance: null,
        estimatedFee: null,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, status: "checking", error: null }));

    try {
      const network = getStellarNetwork();
      const [balance, sufficient] = await Promise.all([
        getSponsorBalance(DEFAULT_SPONSOR_PUBLIC_KEY, network),
        hasSufficientSponsorBalance(DEFAULT_SPONSOR_PUBLIC_KEY, network, 5),
      ]);

      const feeEstimate = estimateSponsoredFee(operationCount);

      setState({
        status: sufficient ? "available" : "insufficient_balance",
        sponsorBalance: balance,
        estimatedFee: feeEstimate,
        error: sufficient
          ? null
          : "Sponsor account balance is too low to cover fees.",
      });
    } catch (err: any) {
      setState({
        status: "error",
        sponsorBalance: null,
        estimatedFee: null,
        error: err.message || "Failed to check sponsorship availability",
      });
    }
  }, [operationCount]);

  useEffect(() => {
    checkSponsorship();
  }, [checkSponsorship]);

  return {
    ...state,
    sponsorPublicKey: DEFAULT_SPONSOR_PUBLIC_KEY,
    refresh: checkSponsorship,
    isSponsored: state.status === "available",
      isTestnet: getStellarNetwork() === "testnet",
  };
}
