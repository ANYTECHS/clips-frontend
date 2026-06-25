"use client";

import { useState, useCallback } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { buildBatchTransaction, getStellarServer } from "@/app/lib/stellar";
import { getNetworkPassphrase, getStellarNetwork } from "@/app/lib/networkConfig";
import { createChangeTrustOp } from "@/app/lib/stellarOperations";
import analytics from "@/lib/analytics";

export type TrustlineStatus = "idle" | "building" | "submitting" | "success" | "error";

export interface TrustlineError {
  code: string;
  message: string;
}

export interface TrustlineResult {
  hash: string;
  assetCode: string;
  assetIssuer: string;
  action: "add" | "remove";
}

export interface UseTrustlineOptions {
  onSuccess?: (result: TrustlineResult) => void;
  onError?: (error: TrustlineError) => void;
}

/**
 * Hook for creating and removing Stellar asset trustlines.
 *
 * Supports two signing modes:
 *  - Embedded wallet: pass `secretKey` directly (Web2 flow)
 *  - Freighter: leave `secretKey` undefined — the hook signs via window.freighter
 */
export function useTrustline(options: UseTrustlineOptions = {}) {
  const { onSuccess, onError } = options;

  const [status, setStatus] = useState<TrustlineStatus>("idle");
  const [error, setError] = useState<TrustlineError | null>(null);
  const [result, setResult] = useState<TrustlineResult | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  /**
   * Add or remove a trustline.
   *
   * @param publicKey  - Source account public key
   * @param assetCode  - Asset code, e.g. "USDC"
   * @param assetIssuer - Issuer public key
   * @param action     - "add" (default limit) or "remove" (limit = "0")
   * @param secretKey  - Optional: embedded wallet secret key. If omitted, Freighter is used.
   * @param limit      - Optional custom trust limit (only for "add")
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
