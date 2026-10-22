"use client";

import { useState, useCallback, useEffect } from "react";
import { getStellarNetwork } from "@/app/lib/networkConfig";

/** Core literal indicators tracking the platform's sponsorship eligibility states */
export type SponsorshipStatus =
  | "checking"
  | "available"
  | "insufficient_balance"
  | "unavailable"
  | "error";

/** State container managing real-time metrics tracking funding and verification errors */
export interface FeeSponsorshipState {
  /** Current verification lifecycle status descriptor tag */
  status: SponsorshipStatus;
  /** Evaluated liquid token quantity string held by the sponsor account or null */
  sponsorBalance: string | null;
  /** Structured estimations detailing operation dimensions and gas costs mapped to native tokens */
  estimatedFee: {
    /** The aggregate transaction operation index count */
    totalOps: number;
    /** Standard base network operation metric parameter calculated in Stroops */
    baseFeeStroops: number;
    /** Scaled atomic fee cost boundary total evaluated in Stroops */
    totalFeeStroops: number;
    /** Human readable string asset representation displaying the equivalent total value in standard XLM */
    totalFeeXLM: string;
  } | null;
  /** Detailed string error context message populated when validation failures trigger */
  error: string | null;
}

const DEFAULT_SPONSOR_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SPONSOR_PUBLIC_KEY ?? "";

/** Sponsor-signed fee-bump envelope returned by `POST /api/sponsorship/sponsor` */
export interface FeeSponsorshipGrant {
  /** Fee-bump transaction XDR, signed by the sponsor and ready to submit */
  feeBumpXdr: string;
  /** Hash of the fee-bump transaction */
  hash: string;
  /** Total fee paid by the sponsor, in stroops */
  feeStroops: string;
  /** Account paying the fee */
  sponsorPublicKey: string;
  /** Sponsorships left for this user in the current month */
  remaining: number;
}

/** Error thrown when the platform declines or fails to sponsor a transaction */
export class FeeSponsorshipError extends Error {
  /**
   * @param code - Machine-readable reason from the sponsorship endpoint (e.g. "BUDGET_EXCEEDED").
   * @param message - Human-readable explanation.
   * @param status - HTTP status returned by the endpoint.
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FeeSponsorshipError";
  }
}

/**
 * Ask the platform to pay the fee for a user-signed transaction.
 *
 * Calls `POST /api/sponsorship/sponsor`, which validates eligibility and the
 * monthly budget, then wraps the inner transaction in a sponsor-signed
 * fee-bump envelope.
 *
 * @param params.innerXdr - The inner transaction XDR, already signed by the user.
 * @param params.publicKey - The user's Stellar public key.
 * @returns The sponsor-signed fee-bump envelope.
 * @throws {FeeSponsorshipError} When the request is rejected or fails.
 */
export async function requestFeeSponsorship(params: {
  innerXdr: string;
  publicKey: string;
}): Promise<FeeSponsorshipGrant> {
  let res: Response;
  try {
    res = await fetch("/api/sponsorship/sponsor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new FeeSponsorshipError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Failed to reach the sponsorship service",
      0
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.feeBumpXdr) {
    throw new FeeSponsorshipError(
      body?.code ?? "SPONSORSHIP_FAILED",
      body?.error ?? `Fee sponsorship failed (HTTP ${res.status})`,
      res.status
    );
  }

  return body.data as FeeSponsorshipGrant;
}

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
 * // Show "Fee sponsored by platform" badge
 * }
 * ```
 * * @param operationCount - The amount of operations inside the incoming transaction envelope used for fee scaling calculations.
 * @returns State metrics, fallback indicator bounds, and an execution trigger enabling manual state updates.
 */
export function useFeeSponsorship(operationCount: number = 1) {
  const [state, setState] = useState<FeeSponsorshipState>({
    status: "checking",
    sponsorBalance: null,
    estimatedFee: null,
    error: null,
  });

  /**
   * Evaluates network configurations and account parameters to determine if gas costs can be covered by the platform.
   */
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
      const res = await fetch(`/api/sponsorship?publicKey=${encodeURIComponent(DEFAULT_SPONSOR_PUBLIC_KEY)}&operationCount=${operationCount}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      setState({
        status: data.isAvailable ? "available" : "insufficient_balance",
        sponsorBalance: data.sponsorBalance ?? null,
        estimatedFee: data.feeEstimate ?? null,
        error: data.isAvailable
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
    requestSponsorship: requestFeeSponsorship,
    isSponsored: state.status === "available",
    isTestnet: getStellarNetwork() === "testnet",
  };
}
