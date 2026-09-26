"use client";

import { useState, useCallback, useEffect } from "react";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import {
  getWebAuthnCompatibility,
  type WebAuthnCompatibility,
} from "@/app/lib/webauthnCompatibility";

/** State container tracking WebAuthn registration, cryptographic identifiers, and errors */
export interface PasskeyWalletState {
  /** The base64url encoded unique credential identification string */
  credentialId: string | null;
  /** The derived smart-contract public cryptographic address */
  publicKey: string | null;
  /** Flag indicating if browser supports WebAuthn passkeys */
  isSupported: boolean;
  /** Activity flag indicating if registration ceremony is pending */
  isRegistering: boolean;
  /** Activity flag indicating if signature authentication loop is active */
  isAuthenticating: boolean;
  /** Localized error message */
  error: string | null;
  /** Browser compatibility details used for Safari and fallback handling */
  compatibility: WebAuthnCompatibility | null;
}

/**
 * Hook for WebAuthn-based passkey wallet registration and authentication.
 */
export function usePasskeyWallet(): PasskeyWalletState & {
  register: (username?: string) => Promise<boolean>;
  authenticate: () => Promise<boolean>;
  reset: () => void;
} {
  const [state, setState] = useState<PasskeyWalletState>({
    credentialId: null,
    publicKey: null,
    isSupported: false,
    isRegistering: false,
    isAuthenticating: false,
    error: null,
    compatibility: null,
  });

  useEffect(() => {
    const compatibility = getWebAuthnCompatibility({
      webAuthnSupported: browserSupportsWebAuthn(),
    });
    const savedId = typeof window !== "undefined" ? localStorage.getItem("clipcash_passkey_id") : null;
    
    setState((p) => ({
      ...p,
      isSupported: compatibility.isSupported,
      credentialId: savedId,
      compatibility,
    }));
  }, []);

  const getCompatibility = useCallback(() => {
    const compatibility = getWebAuthnCompatibility({
      webAuthnSupported: browserSupportsWebAuthn(),
    });

    setState((p) => ({
      ...p,
      isSupported: compatibility.isSupported,
      compatibility,
    }));

    return compatibility;
  }, []);

  /**
   * Register a new passkey.
   */
  const register = useCallback(async (username?: string): Promise<boolean> => {
    const compatibility = getCompatibility();
    if (!compatibility.isSupported) {
      setState((p) => ({
        ...p,
        error: compatibility.fallbackMessage ?? "Passkeys are not supported in this browser.",
      }));
      return false;
    }

    setState((p) => ({ ...p, isRegistering: true, error: null }));

    try {
      // 1. Get registration options from server
      const optRes = await fetch("/api/auth/passkey/register", {
        headers: { Accept: "application/json" },
      });

      if (!optRes.ok) {
        const errJson = await optRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch passkey registration options.");
      }

      const options = await optRes.json();

      // 2. Perform WebAuthn registration in browser
      const regResponse = await startRegistration(options);

      // 3. Send WebAuthn response to server for verification & persistence
      const verifyRes = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regResponse),
      });

      if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to verify passkey registration.");
      }

      const verifyData = await verifyRes.json();
      const credentialId = verifyData.credentialId;
      const publicKey = verifyData.publicKey;

      if (typeof window !== "undefined") {
        localStorage.setItem("clipcash_passkey_id", credentialId);
      }

      setState((p) => ({
        ...p,
        credentialId,
        publicKey,
        isRegistering: false,
        isAuthenticating: false,
        error: null,
      }));

      return true;
    } catch (err: unknown) {
      let message = "Passkey registration failed.";

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        message = "Passkey registration was cancelled by the user.";
      } else if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          message = "Passkey registration was cancelled by the user.";
        } else {
          message = err.message;
        }
      }

      if (compatibility.isSafari && message === "Passkey registration failed.") {
        message = compatibility.fallbackMessage ?? "Safari could not complete passkey registration.";
      }

      setState((p) => ({ ...p, isRegistering: false, error: message }));
      return false;
    }
  }, [getCompatibility]);

  /**
   * Authenticate with an existing passkey.
   */
  const authenticate = useCallback(async (): Promise<boolean> => {
    const compatibility = getCompatibility();
    if (!compatibility.isSupported) {
      setState((p) => ({
        ...p,
        error: compatibility.fallbackMessage ?? "Passkeys are not supported in this browser.",
      }));
      return false;
    }

    setState((p) => ({ ...p, isAuthenticating: true, error: null }));

    try {
      // 1. Get authentication options from server
      const optRes = await fetch("/api/auth/passkey/authenticate", {
        headers: { Accept: "application/json" },
      });

      if (!optRes.ok) {
        const errJson = await optRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch passkey authentication options.");
      }

      const options = await optRes.json();

      // 2. Perform WebAuthn authentication assertion in browser
      const authResponse = await startAuthentication(options);

      // 3. Send assertion response to server for verification
      const verifyRes = await fetch("/api/auth/passkey/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to verify passkey authentication.");
      }

      const verifyData = await verifyRes.json();
      const credentialId = verifyData.credentialId;
      const publicKey = verifyData.publicKey;

      setState((p) => ({
        ...p,
        credentialId,
        publicKey,
        isRegistering: false,
        isAuthenticating: false,
        error: null,
      }));

      return true;
    } catch (err: unknown) {
      let message = "Passkey authentication failed.";

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        message = "Passkey authentication was cancelled.";
      } else if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          message = "Passkey authentication was cancelled.";
        } else {
          message = err.message;
        }
      }

      if (compatibility.isSafari && message === "Passkey authentication failed.") {
        message = compatibility.fallbackMessage ?? "Safari could not complete passkey authentication.";
      }

      setState((p) => ({ ...p, isAuthenticating: false, error: message }));
      return false;
    }
  }, [getCompatibility]);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("clipcash_passkey_id");
    }
    setState((p) => ({
      ...p,
      credentialId: null,
      publicKey: null,
      isRegistering: false,
      isAuthenticating: false,
      error: null,
    }));
  }, []);

  return { ...state, register, authenticate, reset };
}
