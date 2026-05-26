"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Stellar transaction status
 */
export type StellarTransactionStatus = 
  | "idle" 
  | "building" 
  | "signing" 
  | "submitting" 
  | "success" 
  | "error";

/**
 * Stellar network configuration
 */
export type StellarNetwork = "testnet" | "mainnet";

/**
 * Transaction result from Stellar
 */
export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
}

/**
 * Transaction error details
 */
export interface StellarTransactionError {
  code: string;
  message: string;
  extras?: Record<string, unknown>;
}

/**
 * Hook state
 */
export interface UseStellarTransactionState {
  status: StellarTransactionStatus;
  isLoading: boolean;
  error: StellarTransactionError | null;
  result: StellarTransactionResult | null;
  transactionHash: string | null;
}

/**
 * Transaction options
 */
export interface StellarTransactionOptions {
  network?: StellarNetwork;
  timeout?: number;
  maxRetries?: number;
  onSuccess?: (result: StellarTransactionResult) => void;
  onError?: (error: StellarTransactionError) => void;
}

/**
 * Transaction builder function type
 */
export type TransactionBuilder = () => Promise<string>; // Returns XDR string

/**
 * Custom hook for handling Stellar transactions with Freighter wallet
 * 
 * @example
 * ```tsx
 * const { executeTransaction, status, error, result } = useStellarTransaction({
 *   network: "testnet",
 *   onSuccess: (result) => console.log("Transaction successful:", result.hash),
 *   onError: (error) => console.error("Transaction failed:", error.message)
 * });
 * 
 * const handleMint = async () => {
 *   await executeTransaction(async () => {
 *     // Build your transaction here
 *     const xdr = await buildMintTransaction();
 *     return xdr;
 *   });
 * };
 * ```
 */
export function useStellarTransaction(options: StellarTransactionOptions = {}) {
  const {
    network = "testnet",
    timeout = 30000,
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
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Check if Freighter wallet is installed
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
   * Get the user's public key from Freighter
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
   * Sign transaction XDR with Freighter
   */
  const signTransaction = useCallback(
    async (xdr: string, publicKey: string): Promise<string> => {
      // @ts-expect-error - Freighter adds this to window
      const freighter = window.freighter;
      
      try {
        const signedXdr = await freighter.signTransaction(xdr, {
          network,
          accountToSign: publicKey,
        });
        
        if (!signedXdr) {
          throw new Error("No signed XDR returned from Freighter");
        }
        
        return signedXdr;
      } catch (err) {
        // User rejected the transaction
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
   * Submit signed transaction to Stellar network
   */
  const submitTransaction = useCallback(
    async (signedXdr: string): Promise<StellarTransactionResult> => {
      const horizonUrl =
        network === "mainnet"
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org";

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${horizonUrl}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `tx=${encodeURIComponent(signedXdr)}`,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error: StellarTransactionError = {
            code: errorData.extras?.result_codes?.transaction || "SUBMISSION_ERROR",
            message: errorData.title || "Failed to submit transaction to Stellar network",
            extras: errorData.extras,
          };
          throw error;
        }

        const result = await response.json();
        return result as StellarTransactionResult;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          const error: StellarTransactionError = {
            code: "TIMEOUT",
            message: "Transaction submission timed out",
          };
          throw error;
        }

        if ((err as StellarTransactionError).code) {
          throw err;
        }

        const error: StellarTransactionError = {
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "Network error occurred",
        };
        throw error;
      }
    },
    [network]
  );

  /**
   * Execute a Stellar transaction
   */
  const executeTransaction = useCallback(
    async (buildTransaction: TransactionBuilder): Promise<StellarTransactionResult | null> => {
      // Check if Freighter is installed
      if (!checkFreighterInstalled()) {
        return null;
      }

      // Reset state
      setState({
        status: "building",
        isLoading: true,
        error: null,
        result: null,
        transactionHash: null,
      });
      retryCountRef.current = 0;

      try {
        // Step 1: Build transaction
        setState((prev) => ({ ...prev, status: "building" }));
        const xdr = await buildTransaction();

        // Step 2: Get public key
        const publicKey = await getPublicKey();

        // Step 3: Sign transaction
        setState((prev) => ({ ...prev, status: "signing" }));
        const signedXdr = await signTransaction(xdr, publicKey);

        // Step 4: Submit transaction with retry logic
        setState((prev) => ({ ...prev, status: "submitting" }));
        let result: StellarTransactionResult | null = null;
        let lastError: StellarTransactionError | null = null;

        while (retryCountRef.current < maxRetries) {
          try {
            result = await submitTransaction(signedXdr);
            break;
          } catch (err) {
            lastError = err as StellarTransactionError;
            retryCountRef.current++;

            // Don't retry on user rejection or certain errors
            if (
              lastError.code === "USER_REJECTED" ||
              lastError.code === "FREIGHTER_NOT_INSTALLED" ||
              lastError.code === "PUBLIC_KEY_ERROR"
            ) {
              break;
            }

            // Wait before retry (exponential backoff)
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

        // Success
        setState({
          status: "success",
          isLoading: false,
          error: null,
          result,
          transactionHash: result.hash,
        });

        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err as StellarTransactionError;
        setState({
          status: "error",
          isLoading: false,
          error,
          result: null,
          transactionHash: null,
        });

        onError?.(error);
        return null;
      }
    },
    [
      checkFreighterInstalled,
      getPublicKey,
      signTransaction,
      submitTransaction,
      maxRetries,
      onSuccess,
      onError,
    ]
  );

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    // Cancel any pending requests
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
    });
    retryCountRef.current = 0;
  }, []);

  /**
   * Cancel ongoing transaction
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

  return {
    // State
    ...state,
    
    // Actions
    executeTransaction,
    reset,
    cancel,
    
    // Utilities
    checkFreighterInstalled,
    getPublicKey,
  };
}

/**
 * Type augmentation for Freighter wallet
 */
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (
        xdr: string,
        options: { network: string; accountToSign: string }
      ) => Promise<string>;
    };
  }
}
