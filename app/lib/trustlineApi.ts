/**
 * Client + shared helpers for the `/api/wallet/trustline` endpoints.
 *
 * Trustline changes are a two-step exchange with the API:
 * 1. POST/DELETE without `signedXdr` → server builds the unsigned change-trust XDR.
 * 2. POST/DELETE with `signedXdr`    → server verifies and submits it to Horizon.
 */

import type { StellarNetwork } from "@/app/lib/networkConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A non-native asset trustline held by an account. */
export interface Trustline {
  assetCode: string;
  assetIssuer: string;
  /** Current balance, as returned by Horizon (7 decimal places). */
  balance: string;
  /** Maximum balance the account is willing to hold. */
  limit: string;
}

/** Subset of a Horizon account balance entry. */
export interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
}

/** Body accepted by POST (add) and DELETE (remove) on `/api/wallet/trustline`. */
export interface TrustlineChangeRequest {
  publicKey: string;
  assetCode: string;
  assetIssuer: string;
  /** Optional trust limit, only used when adding. */
  limit?: string;
  network?: StellarNetwork;
  /** When present, the server submits this signed XDR instead of building a new one. */
  signedXdr?: string;
}

/** Response of the build step. */
export interface TrustlineBuildResponse {
  xdr: string;
  networkPassphrase: string;
}

/** Response of the submit step. */
export interface TrustlineSubmitResponse {
  hash: string;
  ledger: number;
}

/** Error returned by the trustline endpoints. */
export class TrustlineApiError extends Error {
  /**
   * @param code - Machine-readable error code.
   * @param message - Human-readable explanation.
   * @param status - HTTP status (0 for network failures).
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TrustlineApiError";
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Extract trustlines (credit assets only) from Horizon balance lines.
 *
 * @param balances - The `balances` array of a Horizon account.
 */
export function parseHorizonTrustlines(balances: HorizonBalanceLine[]): Trustline[] {
  return balances
    .filter(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        b.asset_code &&
        b.asset_issuer
    )
    .map((b) => ({
      assetCode: b.asset_code!,
      assetIssuer: b.asset_issuer!,
      balance: b.balance,
      limit: b.limit ?? "0",
    }));
}

// ─── Client requests ──────────────────────────────────────────────────────────

const ENDPOINT = "/api/wallet/trustline";

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new TrustlineApiError(
      body?.code ?? "TRUSTLINE_API_ERROR",
      body?.error ?? `Trustline request failed (HTTP ${res.status})`,
      res.status
    );
  }
  return body.data as T;
}

async function send(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    throw new TrustlineApiError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network error",
      0
    );
  }
}

/**
 * List the trustlines of an account.
 *
 * @param publicKey - Account to inspect.
 * @param network - Network to query.
 */
export async function fetchTrustlines(
  publicKey: string,
  network: StellarNetwork
): Promise<Trustline[]> {
  const params = new URLSearchParams({ publicKey, network });
  const res = await send(`${ENDPOINT}?${params.toString()}`, { cache: "no-store" });
  const data = await readJson<{ trustlines: Trustline[] }>(res);
  return data.trustlines ?? [];
}

/**
 * Ask the server to build an unsigned change-trust transaction.
 *
 * @param action - "add" (POST) or "remove" (DELETE).
 * @param request - Trustline description (without `signedXdr`).
 */
export async function buildTrustlineTransaction(
  action: "add" | "remove",
  request: Omit<TrustlineChangeRequest, "signedXdr">
): Promise<TrustlineBuildResponse> {
  const res = await send(ENDPOINT, {
    method: action === "add" ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return readJson<TrustlineBuildResponse>(res);
}

/**
 * Submit a signed change-trust transaction through the server.
 *
 * @param action - "add" (POST) or "remove" (DELETE).
 * @param request - Trustline description including the user's `signedXdr`.
 */
export async function submitTrustlineTransaction(
  action: "add" | "remove",
  request: TrustlineChangeRequest & { signedXdr: string }
): Promise<TrustlineSubmitResponse> {
  const res = await send(ENDPOINT, {
    method: action === "add" ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return readJson<TrustlineSubmitResponse>(res);
}
