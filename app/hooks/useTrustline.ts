"use client";

import { useState, useCallback, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getStellarNetwork, type StellarNetwork } from "@/app/lib/networkConfig";
import {
  buildTrustlineTransaction,
  fetchTrustlines,
  submitTrustlineTransaction,
  TrustlineApiError,
  type Trustline,
} from "@/app/lib/trustlineApi";
import analytics from "@/lib/analytics";

export type { Trustline };

/** Processing lifecycle phases for tracking trustline transaction states */
export type TrustlineStatus = "idle" | "building" | "signing" | "submitting" | "success" | "error";

/** Error boundary payload mapping context keys to localized message content */
export interface TrustlineError {
  /** Machine-readable error code string identifier */
  code: string;
  /** Detailed human-readable contextual message payload */
  message: string;
}

/** Interface payload documenting a successful blockchain modification entry */
export interface TrustlineResult {
  /** The unique hash identifier string of the confirmed ledger transaction */
  hash: string;
  /** The alphanumeric identifier code string for the target asset */
  assetCode: string;
  /** The public cryptographic key address of the issuing account */
  assetIssuer: string;
  /** Explicit descriptor string specifying the direction of the trust alteration */
  action: "add" | "remove";
}

/** Configuration callbacks executed during terminal lifecycle resolution states */
export interface UseTrustlineOptions {
  /** Account whose trustlines are listed; when set, the list loads automatically */
  publicKey?: string | null;
  /** Network override (defaults to the active network) */
  network?: StellarNetwork;
  /** Optional handler callback fired precisely upon successful node verification confirmation */
  onSuccess?: (result: TrustlineResult) => void;
  /** Optional handler callback executed when parsing or network transport errors arise */
  onError?: (error: TrustlineError) => void;
}

/** Stable key identifying a trustline in pending/loading state */
export function trustlineKey(assetCode: string, assetIssuer: string): string {
  return `${assetCode}:${assetIssuer}`;
}

function toTrustlineError(err: unknown, fallback: string): TrustlineError {
  if (err instanceof TrustlineApiError) {
    return { code: err.code, message: err.message };
  }
  if (err !== null && typeof err === "object" && "code" in err && "message" in err) {
    return err as TrustlineError;
  }
  const errMsg =
    err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
  // Handle Freighter user rejection
  const isRejected = errMsg.includes("User declined") || errMsg.includes("rejected");
  return {
    code: isRejected ? "USER_REJECTED" : "TRUSTLINE_ERROR",
    message: isRejected
      ? "Transaction was rejected. Please approve it in your wallet."
      : errMsg || fallback,
  };
}

/**
 * Hook for listing, creating and removing Stellar asset trustlines.
 *
 * Transactions are built and submitted by `/api/wallet/trustline`
 * (POST = add, DELETE = remove); only signing happens in the browser.
 *
 * Supports two signing modes:
 * - Embedded wallet: pass `secretKey` directly (Web2 flow)
 * - Freighter: leave `secretKey` undefined — the hook signs via window.freighter
 * * @param options - Account to list plus success and failure callbacks.
 * @returns State metrics, flags, explicit actions, and clearing hooks.
 */
export function useTrustline(options: UseTrustlineOptions = {}) {
  const { publicKey, network: networkOverride, onSuccess, onError } = options;

  const [status, setStatus] = useState<TrustlineStatus>("idle");
  const [error, setError] = useState<TrustlineError | null>(null);
  const [result, setResult] = useState<TrustlineResult | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [trustlines, setTrustlines] = useState<Trustline[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState<TrustlineError | null>(null);

  /**
   * Reload the trustline list for the configured account.
   */
  const refresh = useCallback(async () => {
    if (!publicKey) {
      setTrustlines([]);
      return;
    }
    setIsListLoading(true);
    setListError(null);
    try {
      setTrustlines(await fetchTrustlines(publicKey, networkOverride ?? getStellarNetwork()));
    } catch (err) {
      setListError(toTrustlineError(err, "Failed to load trustlines."));
    } finally {
      setIsListLoading(false);
    }
  }, [publicKey, networkOverride]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Resets the volatile runtime states to clear historical transaction artifacts.
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setPendingKey(null);
  }, []);

  /**
   * Add or remove a trustline.
   *
   * @param params - Packed parameter arguments defining the trust modifications.
   * @param params.publicKey - Source account public key
   * @param params.assetCode - Asset code, e.g. "USDC"
   * @param params.assetIssuer - Issuer public key
   * @param params.action - "add" (default limit) or "remove" (limit = "0")
   * @param params.secretKey - Optional: embedded wallet secret key. If omitted, Freighter is used.
   * @param params.limit - Optional custom trust limit (only for "add")
   * @returns Resolves to a finalized TrustlineResult structural report on success, or null if errors persist.
   */
  const changeTrustline = useCallback(
    async (params: {
      publicKey: string;
      assetCode: string;
      assetIssuer: string;
      action: "add" | "remove";
      secretKey?: string;
      limit?: string;
    }): Promise<TrustlineResult | null> => {
      const { publicKey: source, assetCode, assetIssuer, action, secretKey, limit } = params;
      const network = networkOverride ?? getStellarNetwork();
      const request = {
        publicKey: source,
        assetCode,
        assetIssuer,
        network,
        ...(action === "add" && limit ? { limit } : {}),
      };

      setStatus("building");
      setError(null);
      setResult(null);
      setPendingKey(trustlineKey(assetCode, assetIssuer));

      try {
        // 1. Server builds the unsigned change-trust transaction
        const { xdr, networkPassphrase } = await buildTrustlineTransaction(action, request);

        // 2. Sign in the browser
        setStatus("signing");
        let signedXdr: string;

        if (secretKey) {
          // Embedded wallet: sign locally with the secret key
          const keypair = StellarSdk.Keypair.fromSecret(secretKey);
          const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
          tx.sign(keypair);
          signedXdr = tx.toEnvelope().toXDR("base64");
        } else {
          // Freighter wallet: request signing from browser extension
          const freighter = window.freighter;
          if (!freighter) {
            throw {
              code: "FREIGHTER_NOT_INSTALLED",
              message: "Freighter wallet is not installed. Please install the Freighter browser extension.",
            } as TrustlineError;
          }
          signedXdr = await freighter.signTransaction(xdr, {
            network: network === "mainnet" ? "PUBLIC" : "TESTNET",
            accountToSign: source,
          });
          if (!signedXdr) {
            throw {
              code: "SIGNING_FAILED",
              message: "Freighter did not return a signed transaction.",
            } as TrustlineError;
          }
        }

        // 3. Server verifies and submits to Horizon
        setStatus("submitting");
        const { hash } = await submitTrustlineTransaction(action, { ...request, signedXdr });

        const trustlineResult: TrustlineResult = { hash, assetCode, assetIssuer, action };

        setStatus("success");
        setResult(trustlineResult);
        setPendingKey(null);
        analytics.trackTrustlineChange({
          action,
          assetCode,
          walletType: secretKey ? "stellar_embedded" : "freighter",
          network,
        });
        onSuccess?.(trustlineResult);
        if (publicKey === source) void refresh();
        return trustlineResult;
      } catch (err: unknown) {
        const trustlineError = toTrustlineError(err, "Failed to update trustline.");
        setStatus("error");
        setError(trustlineError);
        setPendingKey(null);
        onError?.(trustlineError);
        return null;
      }
    },
    [networkOverride, publicKey, refresh, onSuccess, onError]
  );

  return {
    status,
    isLoading: status === "building" || status === "signing" || status === "submitting",
    error,
    result,
    pendingKey,
    trustlines,
    isListLoading,
    listError,
    refresh,
    changeTrustline,
    reset,
  };
}
