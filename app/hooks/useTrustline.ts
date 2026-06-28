"use client";

import { useState, useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { buildBatchTransaction, getStellarServer } from "@/app/lib/stellar";
import { getNetworkPassphrase, getStellarNetwork } from "@/app/lib/networkConfig";
import { createChangeTrustOp } from "@/app/lib/stellarOperations";
import analytics from "@/lib/analytics";

/** Processing lifecycle phases for tracking trustline transaction states */
export type TrustlineStatus = "idle" | "building" | "submitting" | "success" | "error";

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
  /** Optional handler callback fired precisely upon successful node verification confirmation */
  onSuccess?: (result: TrustlineResult) => void;
  /** Optional handler callback executed when parsing or network transport errors arise */
  onError?: (error: TrustlineError) => void;
}

/**
 * Hook for creating and removing Stellar asset trustlines.
 *
 * Supports two signing modes:
 * - Embedded wallet: pass `secretKey` directly (Web2 flow)
 * - Freighter: leave `secretKey` undefined — the hook signs via window.freighter
 * * @param options - Configuration hooks setting success and failure response callbacks.
 * @returns State metrics, flags, explicit actions, and clearing hooks.
 */
export function useTrustline(options: UseTrustlineOptions = {}) {
  const { onSuccess, onError } = options;

  const [status, setStatus] = useState<TrustlineStatus>("idle");
  const [error, setError] = useState<TrustlineError | null>(null);
  const [result, setResult] = useState<TrustlineResult | null>(null);

  /**
   * Resets the volatile runtime states to clear historical transaction artifacts.
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
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
      const { publicKey, assetCode, assetIssuer, action, secretKey, limit } = params;

      setStatus("building");
      setError(null);
      setResult(null);

      try {
        const op = createChangeTrustOp({
          assetCode,
          assetIssuer,
          limit: action === "remove" ? "0" : limit,
        });

        // Build unsigned transaction XDR
        // Stellar memo text is limited to 28 bytes — keep it short
        const memoText = action === "add" ? `Add ${assetCode}` : `Remove ${assetCode}`;
        const batch = await buildBatchTransaction(publicKey, [op], {
          memo: memoText.slice(0, 28),
        });
        if (!batch.ok) {
          throw {
            code: batch.error.code,
            message: batch.error.message,
          } as TrustlineError;
        }
        const { xdr } = batch;

        let signedXdr: string;

        if (secretKey) {
          // Embedded wallet: sign locally with the secret key
          const keypair = StellarSdk.Keypair.fromSecret(secretKey);
          const tx = StellarSdk.TransactionBuilder.fromXDR(
            xdr,
            getNetworkPassphrase()
          );
          tx.sign(keypair);
          signedXdr = tx.toEnvelope().toXDR("base64");
        } else {
          // Freighter wallet: request signing from browser extension
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const freighter = (window as any).freighter;
          if (!freighter) {
            throw {
              code: "FREIGHTER_NOT_INSTALLED",
              message: "Freighter wallet is not installed. Please install the Freighter browser extension.",
            } as TrustlineError;
          }
          const freighterNetwork = getStellarNetwork() === "mainnet" ? "PUBLIC" : "TESTNET";
          signedXdr = await freighter.signTransaction(xdr, {
            network: freighterNetwork,
            accountToSign: publicKey,
          });
          if (!signedXdr) {
            throw {
              code: "SIGNING_FAILED",
              message: "Freighter did not return a signed transaction.",
            } as TrustlineError;
          }
        }

        // Submit to Horizon
        setStatus("submitting");
        const server = getStellarServer();
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
        const horizonResult = await server.submitTransaction(signedTx as StellarSdk.Transaction);

        const trustlineResult: TrustlineResult = {
          hash: horizonResult.hash,
          assetCode,
          assetIssuer,
          action,
        };

        setStatus("success");
        setResult(trustlineResult);
        analytics.trackTrustlineChange({
          action,
          assetCode,
          walletType: secretKey ? "stellar_embedded" : "freighter",
          network: getStellarNetwork(),
        });
        onSuccess?.(trustlineResult);
        return trustlineResult;
      } catch (err: unknown) {
        const isTypedError =
          err !== null &&
          typeof err === "object" &&
          "code" in err &&
          "message" in err;

        // Handle Freighter user rejection
        const errMsg =
          err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
        const isRejected =
          errMsg.includes("User declined") || errMsg.includes("rejected");

        const trustlineError: TrustlineError = isTypedError
          ? (err as TrustlineError)
          : {
              code: isRejected ? "USER_REJECTED" : "TRUSTLINE_ERROR",
              message: isRejected
                ? "Transaction was rejected. Please approve it in your wallet."
                : errMsg || "Failed to update trustline.",
            };

        setStatus("error");
        setError(trustlineError);
        onError?.(trustlineError);
        return null;
      }
    },
    [onSuccess, onError]
  );

  return {
    status,
    isLoading: status === "building" || status === "submitting",
    error,
    result,
    changeTrustline,
    reset,
  };
}
