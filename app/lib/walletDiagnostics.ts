/**
 * walletDiagnostics.ts
 *
 * Connection diagnostics for a Stellar wallet. Each check is independent and
 * resolves to a pass / fail / skipped result with a user-facing message and,
 * for failures the user can act on, a suggested fix.
 *
 * Checks:
 *  - rpc:        Soroban RPC answers `getHealth` with "healthy"
 *  - account:    the account exists on the network (Horizon)
 *  - balance:    native XLM balance >= the account's minimum reserve
 *  - trustline:  the account trusts the configured NFT asset
 *  - contract:   the NFT contract ID is a valid contract address and its
 *                instance is reachable on the network
 *
 * Every network call is bounded by a timeout so a hung endpoint surfaces as a
 * failed check instead of an endless spinner.
 */

import { Contract, StrKey } from "@stellar/stellar-sdk";

import {
  getFriendbotUrl,
  getHorizonUrl,
  getNftContractId,
  getRpcUrl,
  type StellarNetwork,
} from "@/app/lib/networkConfig";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DiagnosticCheckId = "rpc" | "account" | "balance" | "trustline" | "contract";
export type DiagnosticStatus = "pass" | "fail" | "skipped";

export type DiagnosticFix =
  | { kind: "fund"; label: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "retry"; label: string };

export interface DiagnosticCheck {
  id: DiagnosticCheckId;
  label: string;
  status: DiagnosticStatus;
  message: string;
  /** True when the check failed because its request timed out. */
  timedOut?: boolean;
  fix?: DiagnosticFix;
}

export interface DiagnosticReport {
  checks: DiagnosticCheck[];
  /** True when no check failed. */
  healthy: boolean;
  checkedAt: number;
}

export interface DiagnosticOptions {
  publicKey: string;
  network: StellarNetwork;
  /** Per-request timeout in ms. Default 8 000. */
  timeoutMs?: number;
  /** NFT asset the wallet should trust; defaults to NEXT_PUBLIC_STELLAR_NFT_ASSET_* env vars. */
  nftAsset?: { code: string; issuer: string } | null;
  /** NFT contract ID; defaults to the network's configured contract. */
  contractId?: string;
  fetchImpl?: typeof fetch;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 8_000;
/** Stellar base reserve in XLM (protocol constant since protocol 10). */
export const BASE_RESERVE_XLM = 0.5;

export const CHECK_LABELS: Record<DiagnosticCheckId, string> = {
  rpc: "Soroban RPC reachable",
  account: "Account exists on network",
  balance: "Balance covers minimum reserve",
  trustline: "NFT trustline present",
  contract: "NFT contract ID valid",
};

const TRUSTLINE_FIX: DiagnosticFix = {
  kind: "link",
  label: "Add trustline",
  href: "/settings#panel-wallet",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

export class DiagnosticTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs / 1000}s`);
    this.name = "DiagnosticTimeoutError";
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DiagnosticTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall<T>(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  method: string,
  params: unknown,
  timeoutMs: number
): Promise<T> {
  const res = await fetchWithTimeout(
    fetchImpl,
    rpcUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`RPC returned HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "RPC error");
  return body.result as T;
}

function failure(
  id: DiagnosticCheckId,
  err: unknown,
  fallback: string,
  fix?: DiagnosticFix
): DiagnosticCheck {
  const timedOut = err instanceof DiagnosticTimeoutError;
  return {
    id,
    label: CHECK_LABELS[id],
    status: "fail",
    message: timedOut ? `${fallback} (timed out).` : `${fallback}.`,
    timedOut,
    fix: fix ?? { kind: "retry", label: "Retry" },
  };
}

function pass(id: DiagnosticCheckId, message: string): DiagnosticCheck {
  return { id, label: CHECK_LABELS[id], status: "pass", message };
}

function skipped(id: DiagnosticCheckId, message: string): DiagnosticCheck {
  return { id, label: CHECK_LABELS[id], status: "skipped", message };
}

function defaultNftAsset(): { code: string; issuer: string } | null {
  const code = process.env.NEXT_PUBLIC_STELLAR_NFT_ASSET_CODE;
  const issuer = process.env.NEXT_PUBLIC_STELLAR_NFT_ASSET_ISSUER;
  return code && issuer ? { code, issuer } : null;
}

function fundFix(network: StellarNetwork): DiagnosticFix {
  return network === "testnet"
    ? { kind: "fund", label: "Fund account" }
    : { kind: "link", label: "Add XLM", href: "/wallet" };
}

// ─── Horizon account shape (subset) ────────────────────────────────────────────

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonAccount {
  balances: HorizonBalance[];
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
}

/** Minimum XLM an account must hold: (2 + subentries + sponsoring − sponsored) × base reserve. */
export function minimumReserve(account: Pick<HorizonAccount, "subentry_count" | "num_sponsoring" | "num_sponsored">): number {
  const entries =
    2 + account.subentry_count + (account.num_sponsoring ?? 0) - (account.num_sponsored ?? 0);
  return Math.max(entries, 0) * BASE_RESERVE_XLM;
}

// ─── Individual checks ─────────────────────────────────────────────────────────

export async function checkRpc(
  network: StellarNetwork,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<DiagnosticCheck> {
  try {
    const result = await rpcCall<{ status?: string }>(
      fetchImpl,
      getRpcUrl(network),
      "getHealth",
      undefined,
      timeoutMs
    );
    if (result?.status === "healthy") {
      return pass("rpc", "Soroban RPC is reachable and healthy.");
    }
    return failure("rpc", null, `Soroban RPC reported status "${result?.status ?? "unknown"}"`);
  } catch (err) {
    return failure("rpc", err, "Could not reach the Soroban RPC");
  }
}

async function loadAccount(
  publicKey: string,
  network: StellarNetwork,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<{ account: HorizonAccount | null; error: unknown }> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      `${getHorizonUrl(network)}/accounts/${encodeURIComponent(publicKey)}`,
      {},
      timeoutMs
    );
    if (res.status === 404) return { account: null, error: null };
    if (!res.ok) return { account: null, error: new Error(`Horizon returned HTTP ${res.status}`) };
    return { account: (await res.json()) as HorizonAccount, error: null };
  } catch (err) {
    return { account: null, error: err };
  }
}

export async function checkContract(
  contractId: string | undefined,
  network: StellarNetwork,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<DiagnosticCheck> {
  if (!contractId) {
    return failure("contract", null, "No NFT contract ID is configured for this network", {
      kind: "link",
      label: "View setup guide",
      href: "https://github.com/ANYTECHS/clips-frontend/blob/main/STELLAR.md",
    });
  }
  if (!StrKey.isValidContract(contractId)) {
    return failure("contract", null, "The configured NFT contract ID is not a valid contract address");
  }
  try {
    const key = new Contract(contractId).getFootprint().toXDR("base64");
    const result = await rpcCall<{ entries?: unknown[] }>(
      fetchImpl,
      getRpcUrl(network),
      "getLedgerEntries",
      { keys: [key] },
      timeoutMs
    );
    if (result?.entries && result.entries.length > 0) {
      return pass("contract", "NFT contract is deployed and reachable.");
    }
    return failure("contract", null, "NFT contract was not found on this network");
  } catch (err) {
    return failure("contract", err, "Could not verify the NFT contract");
  }
}

// ─── Full diagnostic run ───────────────────────────────────────────────────────

/**
 * Runs every wallet diagnostic in parallel and returns the combined report.
 * Never throws — failures are reported as failed checks.
 */
export async function runWalletDiagnostics(options: DiagnosticOptions): Promise<DiagnosticReport> {
  const {
    publicKey,
    network,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    nftAsset = defaultNftAsset(),
    contractId = getNftContractId(network),
    fetchImpl = fetch,
  } = options;

  const [rpc, accountResult, contract] = await Promise.all([
    checkRpc(network, timeoutMs, fetchImpl),
    loadAccount(publicKey, network, timeoutMs, fetchImpl),
    checkContract(contractId, network, timeoutMs, fetchImpl),
  ]);

  const { account, error: accountError } = accountResult;
  let accountCheck: DiagnosticCheck;
  let balanceCheck: DiagnosticCheck;
  let trustlineCheck: DiagnosticCheck;

  if (accountError) {
    accountCheck = failure("account", accountError, "Could not load the account from Horizon");
    balanceCheck = skipped("balance", "Skipped — account could not be loaded.");
    trustlineCheck = skipped("trustline", "Skipped — account could not be loaded.");
  } else if (!account) {
    accountCheck = failure(
      "account",
      null,
      "This account does not exist on the network yet. Send it XLM to activate it",
      fundFix(network)
    );
    balanceCheck = failure("balance", null, "Balance is 0 XLM", fundFix(network));
    trustlineCheck = skipped("trustline", "Skipped — account is not activated.");
  } else {
    accountCheck = pass("account", "Account is active on the network.");

    const native = account.balances.find((b) => b.asset_type === "native");
    const xlm = native ? parseFloat(native.balance) : 0;
    const reserve = minimumReserve(account);
    balanceCheck =
      xlm >= reserve
        ? pass("balance", `${xlm} XLM covers the ${reserve} XLM minimum reserve.`)
        : failure(
            "balance",
            null,
            `${xlm} XLM is below the ${reserve} XLM minimum reserve`,
            fundFix(network)
          );

    if (!nftAsset) {
      trustlineCheck = skipped("trustline", "No classic NFT asset is configured to trust.");
    } else {
      const hasTrustline = account.balances.some(
        (b) => b.asset_code === nftAsset.code && b.asset_issuer === nftAsset.issuer
      );
      trustlineCheck = hasTrustline
        ? pass("trustline", `Trustline for ${nftAsset.code} is present.`)
        : failure("trustline", null, `No trustline for ${nftAsset.code}`, TRUSTLINE_FIX);
    }
  }

  const checks = [rpc, accountCheck, balanceCheck, trustlineCheck, contract];
  return {
    checks,
    healthy: checks.every((c) => c.status !== "fail"),
    checkedAt: Date.now(),
  };
}

/**
 * Funds a testnet account via Friendbot. Throws on mainnet.
 */
export async function fundWithFriendbot(
  publicKey: string,
  network: StellarNetwork,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${getFriendbotUrl(network)}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`Friendbot returned HTTP ${res.status}`);
}
