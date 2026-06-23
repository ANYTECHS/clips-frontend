"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Wallet connection status
 */
export type WalletConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Wallet connection error
 */
export interface WalletConnectionError {
  code: string;
  message: string;
}

/**
 * Hook state
 */
export interface UseWalletConnectionState {
  status: WalletConnectionStatus;
  isConnecting: boolean;
  isConnected: boolean;
  error: WalletConnectionError | null;
  publicKey: string | null;
  network: "PUBLIC" | "TESTNET" | null;
}

/**
 * Custom hook for managing Freighter wallet connection
 * 
 * @example
 * ```tsx
 * const { connect, disconnect, publicKey, isConnected, isConnecting, error } = useWalletConnection();
 * 
 * const handleConnect = async () => {
 *   await connect();
 * };
 * ```
 */
export function useWalletConnection() {
  const [state, setState] = useState<UseWalletConnectionState>({
    status: "disconnected",
    isConnecting: false,
    isConnected: false,
    error: null,
    publicKey: null,
    network: null,
  });

  /**
   * Check if Freighter wallet is installed
   */
  const checkFreighterInstalled = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    
    // @ts-expect-error - Freighter adds this to window
    const freighter = window.freighter;
    
    return !!freighter;
  }, []);

  /**
   * Get truncated address for display
   */
  const getTruncatedAddress = useCallback((address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, []);

  /**
   * Connect to Freighter wallet
   */
  const connect = useCallback(async (): Promise<boolean> => {
    // Check if Freighter is installed
    if (!checkFreighterInstalled()) {
      const error: WalletConnectionError = {
        code: "FREIGHTER_NOT_INSTALLED",
        message: "Freighter wallet is not installed. Please install the Freighter browser extension.",
      };
      setState({
        status: "error",
        isConnecting: false,
        isConnected: false,
        error,
        publicKey: null,
        network: null,
      });
      return false;
    }

    // Set connecting state
    setState((prev) => ({
      ...prev,
      status: "connecting",
      isConnecting: true,
      error: null,
    }));

    try {
      // @ts-expect-error - Freighter adds this to window
      const freighter = window.freighter;

      // Get public key (this will prompt user to grant access)
      const publicKey = await freighter.getPublicKey();
      
      if (!publicKey) {
        throw new Error("No public key returned from Freighter");
      }

      // Get network
      let network: "PUBLIC" | "TESTNET" = "TESTNET";
      try {
        network = await freighter.getNetwork();
      } catch (err) {
        console.warn("Could not get network from Freighter, defaulting to TESTNET");
      }

      // Set connected state
      setState({
        status: "connected",
        isConnecting: false,
        isConnected: true,
        error: null,
        publicKey,
        network,
      });

      return true;
    } catch (err) {
      // Handle user rejection
      if (err instanceof Error && err.message.includes("User declined")) {
        const error: WalletConnectionError = {
          code: "USER_REJECTED",
          message: "Connection was rejected. Please approve the connection in Freighter.",
        };
        setState({
          status: "error",
          isConnecting: false,
          isConnected: false,
          error,
          publicKey: null,
          network: null,
        });
        return false;
      }

      // Handle other errors
      const error: WalletConnectionError = {
        code: "CONNECTION_ERROR",
        message: err instanceof Error ? err.message : "Failed to connect to Freighter wallet",
      };
      setState({
        status: "error",
        isConnecting: false,
        isConnected: false,
        error,
        publicKey: null,
        network: null,
      });
      return false;
    }
  }, [checkFreighterInstalled]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setState({
      status: "disconnected",
      isConnecting: false,
      isConnected: false,
      error: null,
      publicKey: null,
      network: null,
    });
  }, []);

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      status: prev.isConnected ? "connected" : "disconnected",
    }));
  }, []);

  /**
   * Check if already connected on mount
   */
  useEffect(() => {
    const checkConnection = async () => {
      if (!checkFreighterInstalled()) return;

      try {
        // @ts-expect-error - Freighter adds this to window
        const freighter = window.freighter;
        const isConnected = await freighter.isConnected();
        
        if (isConnected) {
          const publicKey = await freighter.getPublicKey();
          let network: "PUBLIC" | "TESTNET" = "TESTNET";
          
          try {
            network = await freighter.getNetwork();
          } catch (err) {
            console.warn("Could not get network from Freighter");
          }

          setState({
            status: "connected",
            isConnecting: false,
            isConnected: true,
            error: null,
            publicKey,
            network,
          });
        }
      } catch (err) {
        // Silently fail - user is not connected
        console.debug("Wallet not connected on mount");
      }
    };

    checkConnection();
  }, [checkFreighterInstalled]);

  return {
    // State
    ...state,
    
    // Actions
    connect,
    disconnect,
    resetError,
    
    // Utilities
    checkFreighterInstalled,
    getTruncatedAddress,
  };
}
