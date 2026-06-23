"use client";

import { useState, useCallback } from "react";

export interface PasskeyWalletState {
  credentialId: string | null;
  publicKey: string | null;
  isRegistering: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

/**
 * #336 – Passkey PoC: WebAuthn-based wallet registration and authentication.
 *
 * Feasibility notes:
 * - WebAuthn (passkeys) is supported in all modern browsers.
 * - The credential's public key can be used as a deterministic seed for a
 *   Stellar keypair via a Soroban smart-contract account (SEP-43 / passkey-kit).
 * - This PoC stores the credential ID in localStorage and derives a mock
 *   Stellar public key. A production implementation would call a Soroban
 *   contract (e.g. stellar-passkey-kit) to deploy a smart-wallet account.
 */
export function usePasskeyWallet(): PasskeyWalletState & {
  register: (username: string) => Promise<boolean>;
  authenticate: () => Promise<boolean>;
  reset: () => void;
} {
  const [state, setState] = useState<PasskeyWalletState>({
    credentialId: null,
    publicKey: null,
    isRegistering: false,
    isAuthenticating: false,
    error: null,
  });

  /** Convert ArrayBuffer to base64url string */
  const toBase64url = (buf: ArrayBuffer): string =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  /**
   * Derive a deterministic mock Stellar public key from a credential ID.
   * In production this would be the Soroban smart-wallet contract address.
   */
  const derivePublicKey = (credId: string): string => {
    // Prefix with "G" to look like a Stellar public key (PoC only)
    const hash = Array.from(credId)
      .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0)
      .toString(16)
      .toUpperCase()
      .padStart(8, "0");
    return `GPASSKEY${hash}${"A".repeat(48)}`.slice(0, 56);
  };

  /** Register a new passkey on signup */
  const register = useCallback(async (username: string): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      setState((p) => ({ ...p, error: "WebAuthn is not supported in this browser." }));
      return false;
    }

    setState((p) => ({ ...p, isRegistering: true, error: null }));

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "ClipCash", id: window.location.hostname },
          user: {
            id: userId,
            name: username,
            displayName: username,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "required",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error("No credential returned");

      const credentialId = toBase64url(credential.rawId);
      const publicKey = derivePublicKey(credentialId);

      // Persist credential ID for future authentication
      localStorage.setItem("clipcash_passkey_id", credentialId);

      setState({
        credentialId,
        publicKey,
        isRegistering: false,
        isAuthenticating: false,
        error: null,
      });

      return true;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Passkey registration was cancelled."
          : err instanceof Error
          ? err.message
          : "Passkey registration failed.";
      setState((p) => ({ ...p, isRegistering: false, error: message }));
      return false;
    }
  }, []);

  /** Authenticate with an existing passkey */
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      setState((p) => ({ ...p, error: "WebAuthn is not supported in this browser." }));
      return false;
    }

    setState((p) => ({ ...p, isAuthenticating: true, error: null }));

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: "required",
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!assertion) throw new Error("Authentication cancelled");

      const credentialId = toBase64url(assertion.rawId);
      const publicKey = derivePublicKey(credentialId);

      setState({
        credentialId,
        publicKey,
        isRegistering: false,
        isAuthenticating: false,
        error: null,
      });

      return true;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Passkey authentication was cancelled."
          : err instanceof Error
          ? err.message
          : "Passkey authentication failed.";
      setState((p) => ({ ...p, isAuthenticating: false, error: message }));
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem("clipcash_passkey_id");
    setState({ credentialId: null, publicKey: null, isRegistering: false, isAuthenticating: false, error: null });
  }, []);

  return { ...state, register, authenticate, reset };
}
