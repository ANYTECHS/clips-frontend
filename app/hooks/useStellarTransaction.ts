"use client";

import { useState, useCallback, useRef } from "react";
import type { StellarOperation } from "@/app/lib/stellarOperations";
import {
  validateOperations,
  BatchValidationError,
  INVOKE_CONTRACT_USER_MESSAGE,
  isInvokeContractBuildError,
} from "@/app/lib/stellarOperations";
import { captureSorobanNotSupportedWarning } from "@/app/lib/sentry";
import { TRANSACTION_TIMEOUT_MS } from "@/app/lib/constants";
import { logger } from "@/app/lib/logger";
import { submitTransaction } from "@/app/lib/stellar";

/**
 * Stellar transaction processing lifecycle state designations.
 */
export type StellarTransactionStatus =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

/**
 * Supported operational core network types.
 */
export type StellarNetwork = "testnet" | "mainnet";

/**
 * Transaction result from Stellar.
 */
export type StellarTransactionResult = Awaited<ReturnType<typeof submitTransaction>>;

/**
 * Transaction error details.
 */
export interface StellarTransactionError {
  /** Standard error identifier code */
  code: string;
  /** Human-readable explanation of the error */
  message: string;
  /** Optional dictionary context returned from Horizon */
  extras?: Record<string, unknown>;
}

/**
 * Hook state layout tracking active transaction mutations.
 */
export interface UseStellarTransactionState {
  /** The current phase of the transaction lifecycle */
  status: StellarTransactionStatus;
  /** Flags whether a background network operation is running */
  isLoading: boolean;
  /** Details about the failure if the status transitions to 'error' */
  error: StellarTransactionError | null;
  /** The success payload context received from Horizon */
  result: StellarTransactionResult | null;
  /** The transaction hash string shortcut if successful */
  transactionHash: string | null;
  /** Operations queued for the next batch transaction */
  queuedOperations: QueuedOperation[];
}

/**
 * Transaction configuration criteria parameters.
 */
export interface StellarTransactionOptions {
  /** Target blockchain environment defaults to testnet */
  network?: StellarNetwork;
  /** Maximum lifespan of the transaction dispatch request in ms */
  timeout?: number;
  /** Amount of automated resubmission attempts on failures */
  maxRetries?: number;
  /** Optional interceptor invoked immediately upon transaction settlement */
  onSuccess?: (result: StellarTransactionResult) => void;
  /** Optional handler callback fired on any rejection or network error */
  onError?: (error: StellarTransactionError) => void;
}

/**
 * Transaction builder function type yielding base64 XDR vectors.
 */
export type TransactionBuilder = () => Promise<string>;

/**
 * Batch transaction builder processing atomic structural queues.
 */
export type BatchTransactionBuilder = (
  operations: StellarOperation[]
) => Promise<string>;

/**
 * Queued operation context schema tracking localized indices.
 */
export interface QueuedOperation {
  /** The operation details descriptor payload */
  operation: StellarOperation;
  /** Human-readable label shown in confirmation UI (e.g. "Add USDC trustline") */
  label?: string;
}

/**
 * Custom hook for handling Stellar transactions with Freighter wallet.
 * * @example
 * ```tsx
 * const { executeTransaction, status, error, result } = useStellarTransaction({
 * network: "testnet",
 * onSuccess: (result) => console.log("Transaction successful:", result.hash),
 * onError: (error) => console.error("Transaction failed:", error.message)
 * });
 * * const handleMint = async () => {
 * await executeTransaction(async () => {
 * const xdr = await buildMintTransaction();
 * return xdr;
 * });
 * };
 * ```
 * * @param options - Configuration options for network environment, timeouts, and callbacks.
 * @returns The reactive transaction state and action management utilities.
 */
export function useStellarTransaction(options: StellarTransactionOptions = {}) {
  const {
    network = "testnet",
    timeout = TRANSACTION_TIMEOUT_MS,
    maxRetries = 3,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UseStellarTransactionState>({
    status: "idle",
    isLoading: false,
    error: null,
    result: null,
    transactionHash: null,
    queuedOperations: [],
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Check if Freighter wallet is installed in the client's browser window.
   * Modifies internal hook error state if verification fails.
   *
   * @returns True if window.freighter is present, false otherwise.
   */
  const checkFreighterInstalled = useCallback((): boolean => {
    if (typeof window === "undefined") return false;

    // @ts-expect-error - Freighter adds this to window
    const freighter = window.freighter;

    if (!freighter) {
      const error: StellarTransactionError = {
        code: "FREIGHTER_NOT_INSTALLED",
        message: "Freighter wallet is not installed. Please install the Freighter browser extension.",
      };
      setState((prev) => ({
        ...prev,
        status: "error",
        isLoading: false,
        error,
      }));
      onError?.(error);
      return false;
    }

    return true;
  }, [onError]);

  /**
   * Retrieves the current user's authenticated public key from the Freighter extension.
   *
   * @returns Resolves to the public key string.
   * @throws {StellarTransactionError} If the public key extraction rejects or comes back empty.
   */
  const getPublicKey = useCallback(async (): Promise<string> => {
    // @ts-expect-error - Freighter adds this to window
    const freighter = window.freighter;

    try {
      const publicKey = await freighter.getPublicKey();
      if (!publicKey) {
        throw new Error("No public key returned from Freighter");
      }
      return publicKey;
    } catch (err) {
      const error: StellarTransactionError = {
        code: "PUBLIC_KEY_ERROR",
        message: err instanceof Error ? err.message : "Failed to get public key from Freighter",
      };
      throw error;
    }
  }, []);

  /**
   * Prompts the user to authorize and sign an unsigned transaction XDR string through Freighter.
   *
   * @param xdr - The unsigned base64 transaction envelope string.
   * @param publicKey - The public key address expected to sign the transaction payload.
   * @returns Resolves with the signed transaction envelope XDR string.
   * @throws {StellarTransactionError} If user explicitly declines or if cryptographic signing fails.
   */
  const signTransaction = useCallback(
    async (xdr: string, publicKey: string): Promise<string> => {
      // @ts-expect-error - Freighter adds this to window
      const freighter = window.freighter;
      const freighterNetwork = network === "mainnet" ? "PUBLIC" : "TESTNET";

      try {
        const signedXdr = await freighter.signTransaction(xdr, {
          network: freighterNetwork,
          accountToSign: publicKey,
        });

        if (!signedXdr) {
          throw new Error("No signed XDR returned from Freighter");
        }

        return signedXdr;
      } catch (err) {
        if (err instanceof Error && err.message.includes("User declined")) {
          const error: StellarTransactionError = {
            code: "USER_REJECTED",
            message: "Transaction was rejected. Please approve the transaction in Freighter.",
          };
          throw error;
        }

        const error: StellarTransactionError = {
          code: "SIGNING_ERROR",
          message: err instanceof Error ? err.message : "Failed to sign transaction",
        };
        throw error;
      }
    },
    [network]
  );

  /**
   * Orchestrates the full lifecycle of a transaction build, sign, and submit routine.
   *
   * @param buildTransaction - Callback returning the initial unsigned XDR string target.
   * @returns Resolves with transaction indicators, or null if an error or rejection breaks execution.
   */
  const executeTransaction = useCallback(
    async (buildTransaction: TransactionBuilder): Promise<StellarTransactionResult | null> => {
      if (!checkFreighterInstalled()) {
        return null;
      }

      setState((prev) => ({
        ...prev,
        status: "building",
        isLoading: true,
        error: null,
        result: null,
        transactionHash: null,
      }));
      retryCountRef.current = 0;

      try {
        setState((prev) => ({ ...prev, status: "building" }));
        const xdr = await buildTransaction();

        const publicKey = await getPublicKey();

        setState((prev) => ({ ...prev, status: "signing" }));
        const signedXdr = await signTransaction(xdr, publicKey);

        setState((prev) => ({ ...prev, status: "submitting" }));
        let result: StellarTransactionResult | null = null;
        let lastError: StellarTransactionError | null = null;

        while (retryCountRef.current < maxRetries) {
          try {
            result = await submitTransaction({ signedXdr, network });
            break;
          } catch (err) {
            lastError = err as StellarTransactionError;
            retryCountRef.current++;

            if (
              lastError.code === "USER_REJECTED" ||
              lastError.code === "FREIGHTER_NOT_INSTALLED" ||
              lastError.code === "PUBLIC_KEY_ERROR"
            ) {
              break;
            }

            if (retryCountRef.current < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, retryCountRef.current) * 1000)
              );
            }
          }
        }

        if (!result) {
          throw lastError || new Error("Transaction failed");
        }

        setState({
          status: "success",
          isLoading: false,
          error: null,
          result,
          transactionHash: result.hash,
          queuedOperations: [],
        });

        onSuccess?.(result);
        return result;
      } catch (err) {
        if (isInvokeContractBuildError(err)) {
          captureSorobanNotSupportedWarning({ source: "executeTransaction" });
          const error: StellarTransactionError = {
            code: "INVOKE_CONTRACT_NOT_SUPPORTED",
            message: INVOKE_CONTRACT_USER_MESSAGE,
          };
          setState((prev) => ({
            ...prev,
            status: "error",
            isLoading: false,
            error,
            result: null,
            transactionHash: null,
          }));
          onError?.(error);
          return null;
        }

        const error = err as StellarTransactionError;
        setState((prev) => ({
          ...prev,
          status: "error",
          isLoading: false,
          error,
          result: null,
          transactionHash: null,
        }));

        onError?.(error);
        return null;
      }
    },
    [
      checkFreighterInstalled,
      getPublicKey,
      signTransaction,
      network,
      maxRetries,
      onSuccess,
      onError,
    ]
  );

  /**
   * Resets the runtime hooks configuration state to fallback defaults, aborting any active requests.
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      status: "idle",
      isLoading: false,
      error: null,
      result: null,
      transactionHash: null,
      queuedOperations: [],
    });
    retryCountRef.current = 0;
  }, []);

  /**
   * Cancels ongoing network submission requests, setting state handles to idle.
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      status: "idle",
      isLoading: false,
    }));
  }, []);

  /**
   * Add one or more operations to the batch queue.
   * Operations are validated immediately — throws `BatchValidationError` if
   * any operation descriptor is invalid.
   * * @example
   * addOperation(createChangeTrustOp({ assetCode: "USDC", assetIssuer: "G..." }), "Add USDC trustline");
   * * @param operation - The structured data properties representing the operation type.
   * @param label - Optional user interface description context string.
   * @throws {BatchValidationError} When immediate schema enforcement validation rules are triggered.
   */
  const addOperation = useCallback(
    (operation: StellarOperation, label?: string) => {
      setState((prev) => {
        const updated = [...prev.queuedOperations, { operation, label }];
        try {
          validateOperations(updated.map((q) => q.operation));
        } catch (err) {
          if (err instanceof BatchValidationError) {
            throw err;
          }
          throw err;
        }
        return { ...prev, queuedOperations: updated };
      });
    },
    []
  );

  /**
   * Remove the operation at `index` from the batch queue.
   *
   * @param index - The array pointer position of the element target to drop.
   */
  const removeOperation = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      queuedOperations: prev.queuedOperations.filter((_, i) => i !== index),
    }));
  }, []);

  /**
   * Clear all queued operations without resetting transaction state.
   */
  const clearOperations = useCallback(() => {
    setState((prev) => ({ ...prev, queuedOperations: [] }));
  }, []);

  /**
   * Execute all queued operations as a single atomic Stellar transaction.
   * * @example
   * await executeBatchTransaction(async (ops) => {
   * const { xdr } = await buildBatchTransaction(publicKey, ops, { memo: "batch" });
   * return xdr;
   * });
   * * @param buildBatch - The composition helper building the final execution string context.
   * @returns Structural metrics array pointers on successful ledger settlement or null.
   */
  const executeBatchTransaction = useCallback(
    async (
      buildBatch: BatchTransactionBuilder
    ): Promise<StellarTransactionResult | null> => {
      const currentOps = state.queuedOperations;

      if (currentOps.length === 0) {
        const error: StellarTransactionError = {
          code: "EMPTY_BATCH",
          message: "No operations queued. Add at least one operation before executing.",
        };
        setState((prev) => ({
          ...prev,
          status: "error",
          isLoading: false,
          error,
        }));
        onError?.(error);
        return null;
      }

      const invokeContractIndex = currentOps.findIndex(
        (q) => q.operation.type === "invoke_contract"
      );
      if (invokeContractIndex >= 0) {
        captureSorobanNotSupportedWarning({
          source: "executeBatchTransaction",
          operationIndex: invokeContractIndex,
        });
        const error: StellarTransactionError = {
          code: "INVOKE_CONTRACT_NOT_SUPPORTED",
          message: INVOKE_CONTRACT_USER_MESSAGE,
        };
        setState((prev) => ({
          ...prev,
          status: "error",
          isLoading: false,
          error,
        }));
        onError?.(error);
        return null;
      }

      try {
        validateOperations(currentOps.map((q) => q.operation));
      } catch (err) {
        const error: StellarTransactionError = {
          code: "BATCH_VALIDATION_ERROR",
          message: err instanceof Error ? err.message : "Batch validation failed",
        };
        setState((prev) => ({
          ...prev,
          status: "error",
          isLoading: false,
          error,
        }));
        onError?.(error);
        return null;
      }

      return executeTransaction(() =>
        buildBatch(currentOps.map((q) => q.operation))
      );
    },
    [state.queuedOperations, executeTransaction, onError]
  );

  return {
    ...state,
    executeTransaction,
    reset,
    cancel,
    addOperation,
    removeOperation,
    clearOperations,
    executeBatchTransaction,
    checkFreighterInstalled,
    getPublicKey,
  };
}

/**
 * Type augmentation for Freighter wallet injection channels.
 */
declare global {
  interface Window {
    /** Global environment connection instance payload injected by the Freighter extension */
    freighter?: {
      /** Checks connection authority state indicators */
      isConnected: () => Promise<boolean>;
      /** Extracts user cryptographic addresses */
      getPublicKey: () => Promise<string>;
      /** Triggers extension modal validation overlays to sign data packets */
      signTransaction: (
        xdr: string,
        options: { network: string; accountToSign: string }
      ) => Promise<string>;
    };
  }
}