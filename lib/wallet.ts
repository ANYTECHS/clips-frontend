"use client";

// Stellar Wallet integration using @creit-tech/stellar-wallets-kit v2
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { LobstrModule } from "@creit-tech/stellar-wallets-kit/modules/lobstr";
import { AlbedoModule } from "@creit-tech/stellar-wallets-kit/modules/albedo";
import { RabetModule } from "@creit-tech/stellar-wallets-kit/modules/rabet";
import { Networks } from "@creit-tech/stellar-wallets-kit/types";

const rawNetwork = (process.env.NEXT_PUBLIC_STELLAR_NETWORK || "").trim().toLowerCase();
export const STELLAR_NETWORK =
  rawNetwork === "public" || rawNetwork === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

let kitInitialised = false;

export function initWalletKit(): void {
  if (kitInitialised || typeof window === "undefined") return;
  kitInitialised = true;

  StellarWalletsKit.init({
    modules: [
      new FreighterModule(),
      new LobstrModule(),
      new AlbedoModule(),
      new RabetModule(),
    ],
    network: STELLAR_NETWORK,
  });
}

export async function connectWalletModal(): Promise<string> {
  initWalletKit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

export async function getWalletAddress(): Promise<string> {
  const { address } = await StellarWalletsKit.getAddress();
  return address;
}

export async function openProfileModal(): Promise<void> {
  await StellarWalletsKit.profileModal();
}

export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

export async function signAuthMessage(message: string): Promise<string> {
  initWalletKit();
  const { address } = await StellarWalletsKit.getAddress();
  const { signedMessage } = await StellarWalletsKit.signMessage(message, {
    address,
  });
  return signedMessage;
}

// Signs transaction XDR with networkPassphrase to ensure correct network validation
export async function signTransaction(xdr: string): Promise<string> {
  initWalletKit();
  const { address } = await StellarWalletsKit.getAddress();

  const networkPassphrase =
    STELLAR_NETWORK === Networks.PUBLIC
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015";

  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    address,
    networkPassphrase,
  });
  return signedTxXdr;
}

// Normalizes wallet signature to a 128-character lowercase hex string
export function ensureHexSignature(signature: string): string {
  if (signature.startsWith("ed25519:")) {
    signature = signature.slice(8);
  }

  if (/^[0-9a-fA-F]{128}$/.test(signature)) {
    return signature.toLowerCase();
  }

  try {
    const b64 = signature
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/\s/g, "");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const binary = atob(padded);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Freighter signMessage can prepend 2 bytes (66 bytes total)
    const sigBytes = bytes.length === 66 ? bytes.slice(2) : bytes;
    const sigHex   = Array.from(sigBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (sigHex.length === 128) return sigHex;
  } catch (e) {
    console.warn("[ensureHexSignature] decode failed:", e);
  }

  return signature;
}

// Checks if Stellar account has an active USDC trustline
export async function hasUsdcTrustline(stellarAddress: string): Promise<boolean> {
  const horizonUrl =
    STELLAR_NETWORK === Networks.PUBLIC
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  const usdcIssuer =
    STELLAR_NETWORK === Networks.PUBLIC
      ? "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      : "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

  try {
    const res = await fetch(`${horizonUrl}/accounts/${stellarAddress}`);
    console.log(`[hasUsdcTrustline] checking ${stellarAddress} on ${horizonUrl} → HTTP ${res.status}`);

    if (res.status === 404) {
      console.warn("[hasUsdcTrustline] account not found — not activated yet");
      return false;
    }
    if (!res.ok) {
      console.warn("[hasUsdcTrustline] Horizon error", res.status);
      return false;
    }

    const data = await res.json();
    const balances: { asset_type: string; asset_code?: string; asset_issuer?: string }[] =
      data?.balances ?? [];

    console.log("[hasUsdcTrustline] balances:", JSON.stringify(balances));

    const found = balances.some(
      (b) => b.asset_code === "USDC" && b.asset_issuer === usdcIssuer
    );
    console.log(`[hasUsdcTrustline] USDC trustline found: ${found}`);
    return found;
  } catch (err) {
    // Log but don't block — let Horizon surface the real error on submit
    console.warn("[hasUsdcTrustline] fetch failed:", err);
    return true;
  }
}



// Submits signed Stellar transaction XDR directly to Horizon
export async function submitToStellar(signedXdr: string): Promise<string> {
  const horizonUrl =
    STELLAR_NETWORK === Networks.PUBLIC
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  const body = new URLSearchParams({ tx: signedXdr });

  const res = await fetch(`${horizonUrl}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const codes   = data?.extras?.result_codes ?? {};
    const txCode  = codes?.transaction  ?? "";
    const opCodes: string[] = codes?.operations ?? [];

    // Always log the raw codes so they're visible in the browser console
    console.error("[submitToStellar] failed — result_codes:", JSON.stringify(codes));

    const isPublic = STELLAR_NETWORK === Networks.PUBLIC;
    const networkLabel = isPublic ? "Public (Mainnet)" : "Testnet";

    // ── Transaction-level codes ──────────────────────────────────────────────
    if (txCode === "tx_bad_auth") {
      throw new Error(
        `Wallet signature invalid. Please verify network is set to ${networkLabel} and retry.`
      );
    }
    if (txCode === "tx_bad_seq") {
      throw new Error("Transaction out of sync. Please try again.");
    }
    if (txCode === "tx_no_account") {
      throw new Error("Wallet not activated yet. Please fund it with at least 2 XLM first.");
    }
    if (txCode === "tx_insufficient_fee") {
      throw new Error("Transaction fee too low. Please retry.");
    }

    // ── Operation-level codes ────────────────────────────────────────────────
    if (opCodes.includes("op_underfunded")) {
      throw new Error("Insufficient XLM or USDC balance in your wallet.");
    }
    if (opCodes.includes("op_no_trust")) {
      throw new Error("USDC trustline missing. Please enable USDC in your Freighter wallet.");
    }
    if (opCodes.includes("op_line_full")) {
      throw new Error("USDC trustline limit reached for recipient account.");
    }
    if (opCodes.includes("op_no_destination")) {
      throw new Error(`Recipient wallet does not exist on Stellar ${networkLabel}.`);
    }
    if (opCodes.includes("op_not_authorized")) {
      throw new Error("Transaction asset is not authorized by the issuer.");
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    throw new Error("Transaction could not be completed. Please try again.");
  }

  const hash: string = data?.hash;
  if (!hash) throw new Error("Stellar returned no transaction hash.");
  return hash;
}

export { StellarWalletsKit, Networks };
