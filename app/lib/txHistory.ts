/**
 * txHistory.ts
 *
 * Fetches on-chain transaction history for MetaMask (Ethereum) and
 * Phantom (Solana) wallets.
 *
 * Design decisions
 * ─────────────────
 * - All fetching happens client-side; this module is imported only in
 *   browser contexts (client components / hooks marked "use client").
 * - Rate limiting: at most 10 requests per minute per wallet address
 *   (requirement 12.7 / spec req 2.8 / 3.8). Requests that exceed the
 *   limit receive a RateLimitError so callers can show a friendly message.
 * - Per-page cache: responses are kept for 30 s to avoid redundant API
 *   calls when the user navigates back to a previously viewed page.
 * - Retry: up to 3 attempts with exponential backoff (1s → 2s → 4s).
 * - Private keys are never touched; only public addresses are used.
 * - Wallet addresses are not logged in full (only first 6 + last 4 chars).
 */

import { logger } from "@/app/lib/logger";

// ─── Public types ──────────────────────────────────────────────────────────────

export type TxDirection = "incoming" | "outgoing" | "self";
export type TxStatus = "pending" | "confirmed" | "failed";
export type TxChain = "ethereum" | "solana";

export interface Transaction {
  id: string;             // tx hash / signature
  chain: TxChain;
  direction: TxDirection;
  status: TxStatus;
  timestamp: number;      // Unix ms
  fromAddress: string;
  toAddress: string;
  amount: string;         // human-readable, e.g. "0.005"
  assetSymbol: string;    // "ETH" | "SOL" | token symbol
  fee?: string;           // gas / transaction fee in native units
  blockConfirmations?: number;
  memo?: string;
  explorerUrl: string;
}

export type TxFilter = "all" | "sent" | "received";

// ─── Errors ────────────────────────────────────────────────────────────────────

export class TxHistoryError extends Error {
  constructor(
    message: string,
    public readonly code: "RATE_LIMITED" | "NETWORK_ERROR" | "INVALID_ADDRESS" | "API_ERROR" | "UNKNOWN",
  ) {
    super(message);
    this.name = "TxHistoryError";
  }
}

// ─── Rate limiter ──────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const requestLog = new Map<string, number[]>();

function checkRateLimit(address: string): void {
  const now = Date.now();
  const key = address.slice(0, 6);              // don't store full address
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    throw new TxHistoryError(
      "Rate limit exceeded. Please wait a moment before retrying.",
      "RATE_LIMITED",
    );
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
}

// ─── Response cache ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: Transaction[];
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): Transaction[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: Transaction[]): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

export function clearTxCache(address: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(address.slice(0, 6))) cache.delete(key);
  }
}

// ─── Retry helper ──────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof TxHistoryError && err.code === "RATE_LIMITED") throw err;
      if (err instanceof TxHistoryError && err.code === "INVALID_ADDRESS") throw err;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Address helpers ───────────────────────────────────────────────────────────

/** Partial address for safe logging — never logs full address */
function safeAddr(addr: string): string {
  if (addr.length <= 10) return "***";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function truncateForDisplay(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Ethereum (Etherscan) ──────────────────────────────────────────────────────

/** Etherscan base URLs by chainId (hex string) */
const ETHERSCAN_URLS: Record<string, { api: string; explorer: string }> = {
  "0x1":    { api: "https://api.etherscan.io/api",                 explorer: "https://etherscan.io/tx/" },
  "0xaa36a7":{ api: "https://api-sepolia.etherscan.io/api",         explorer: "https://sepolia.etherscan.io/tx/" },
  "0x5":    { api: "https://api-goerli.etherscan.io/api",           explorer: "https://goerli.etherscan.io/tx/" },
};

const DEFAULT_ETHERSCAN = ETHERSCAN_URLS["0x1"];

function getEtherscan(chainId: string | null) {
  if (!chainId) return DEFAULT_ETHERSCAN;
  return ETHERSCAN_URLS[chainId.toLowerCase()] ?? DEFAULT_ETHERSCAN;
}

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;        // in Wei
  gasUsed: string;
  gasPrice: string;
  timeStamp: string;    // Unix seconds as string
  confirmations: string;
  txreceipt_status: string;  // "0" | "1"
  isError: string;           // "0" | "1"
}

function weiToEth(wei: string): string {
  const val = BigInt(wei || "0");
  const eth = Number(val) / 1e18;
  return eth.toFixed(eth < 0.001 ? 8 : 5);
}

async function fetchEthereumTxs(
  address: string,
  chainId: string | null,
  page: number,
): Promise<Transaction[]> {
  const cacheKey = `eth:${address}:${chainId}:${page}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  checkRateLimit(address);

  const { api, explorer } = getEtherscan(chainId);
  const offset = 50;
  const pageNum = page;
  const url = `${api}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${pageNum}&offset=${offset}&sort=desc&apikey=${typeof window !== "undefined" ? "" : ""}`;

  logger.debug(`[txHistory] fetching Ethereum txs for ${safeAddr(address)} page ${page}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new TxHistoryError(`Etherscan request failed: ${res.status}`, "API_ERROR");
  }

  const json = await res.json() as {
    status: string;
    message: string;
    result: EtherscanTx[] | string;
  };

  if (json.status !== "1") {
    // "No transactions found" is not a real error
    if (typeof json.result === "string" && json.result.includes("No transactions")) {
      setCached(cacheKey, []);
      return [];
    }
    throw new TxHistoryError(`Etherscan API: ${json.message}`, "API_ERROR");
  }

  const raw = json.result as EtherscanTx[];
  const lowerAddress = address.toLowerCase();

  const txs: Transaction[] = raw.map((tx) => {
    const from = tx.from.toLowerCase();
    const to = (tx.to ?? "").toLowerCase();
    const direction: TxDirection = from === lowerAddress && to === lowerAddress
      ? "self"
      : from === lowerAddress
      ? "outgoing"
      : "incoming";

    const status: TxStatus = tx.isError === "1"
      ? "failed"
      : tx.txreceipt_status === "0"
      ? "pending"
      : "confirmed";

    const confirmations = parseInt(tx.confirmations, 10);
    const gasFeeWei = (BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0")).toString();

    return {
      id: tx.hash,
      chain: "ethereum",
      direction,
      status,
      timestamp: parseInt(tx.timeStamp, 10) * 1000,
      fromAddress: truncateForDisplay(tx.from),
      toAddress: truncateForDisplay(tx.to ?? ""),
      amount: weiToEth(tx.value),
      assetSymbol: "ETH",
      fee: weiToEth(gasFeeWei),
      blockConfirmations: confirmations < 10 ? confirmations : undefined,
      explorerUrl: `${explorer}${tx.hash}`,
    };
  });

  setCached(cacheKey, txs);
  return txs;
}

// ─── Solana (Solscan public API) ───────────────────────────────────────────────

interface SolscanTx {
  signature: string;
  blockTime: number;
  status: "Success" | "Fail";
  fee: number;           // in lamports
  lamport?: number;      // net lamport change (may be absent)
  signer: string[];
  slot: number;
}

function lamportsToSol(lamports: number): string {
  return (lamports / 1e9).toFixed(9).replace(/\.?0+$/, "");
}

function getSolscanExplorerUrl(sig: string, _cluster?: string): string {
  // Use mainnet explorer; add ?cluster=devnet for devnet
  return `https://solscan.io/tx/${sig}`;
}

async function fetchSolanaTxs(
  address: string,
  page: number,
): Promise<Transaction[]> {
  const cacheKey = `sol:${address}:${page}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  checkRateLimit(address);

  const limit = 50;
  const before = page > 1 ? "" : ""; // Solscan v1 uses `beforeHash` for pagination; simplified here
  const url = `https://public-api.solscan.io/account/transactions?account=${address}&limit=${limit}`;

  logger.debug(`[txHistory] fetching Solana txs for ${safeAddr(address)} page ${page}`);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 429) {
    throw new TxHistoryError("Rate limit exceeded by Solscan API. Please wait a moment.", "RATE_LIMITED");
  }

  if (!res.ok) {
    throw new TxHistoryError(`Solscan request failed: ${res.status}`, "API_ERROR");
  }

  const raw = await res.json() as SolscanTx[];

  if (!Array.isArray(raw)) {
    setCached(cacheKey, []);
    return [];
  }

  const txs: Transaction[] = raw.map((tx) => {
    const isSigner = tx.signer.includes(address);
    const direction: TxDirection = isSigner ? "outgoing" : "incoming";
    const status: TxStatus = tx.status === "Success" ? "confirmed" : "failed";

    const lamportChange = tx.lamport ?? 0;
    const amount = lamportsToSol(Math.abs(lamportChange));

    return {
      id: tx.signature,
      chain: "solana",
      direction,
      status,
      timestamp: tx.blockTime * 1000,
      fromAddress: isSigner ? truncateForDisplay(address) : "Unknown",
      toAddress: isSigner ? "Unknown" : truncateForDisplay(address),
      amount,
      assetSymbol: "SOL",
      fee: lamportsToSol(tx.fee),
      explorerUrl: getSolscanExplorerUrl(tx.signature),
    };
  });

  setCached(cacheKey, txs);
  return txs;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export type WalletType = "metamask" | "phantom";

/**
 * Fetch the transaction history for a connected wallet.
 *
 * @param walletType   "metamask" or "phantom"
 * @param address      Public wallet address
 * @param chainId      Hex chain ID (MetaMask only, e.g. "0x1")
 * @param page         1-based page number (50 txs per page from the API)
 */
export async function fetchTransactionHistory(
  walletType: WalletType,
  address: string,
  chainId: string | null,
  page: number,
): Promise<Transaction[]> {
  if (!address) {
    throw new TxHistoryError("No wallet address provided.", "INVALID_ADDRESS");
  }

  try {
    if (walletType === "metamask") {
      return await withRetry(() => fetchEthereumTxs(address, chainId, page));
    } else {
      return await withRetry(() => fetchSolanaTxs(address, page));
    }
  } catch (err) {
    if (err instanceof TxHistoryError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[txHistory] fetch failed for ${safeAddr(address)}:`, err);
    throw new TxHistoryError(msg, "UNKNOWN");
  }
}

/**
 * Apply a direction filter to an array of transactions.
 */
export function filterTransactions(txs: Transaction[], filter: TxFilter): Transaction[] {
  if (filter === "all") return txs;
  if (filter === "sent") return txs.filter((tx) => tx.direction === "outgoing");
  return txs.filter((tx) => tx.direction === "incoming");
}

/**
 * Format a Unix-ms timestamp into the display format "MMM DD, YYYY HH:MM AM/PM"
 * in the user's local timezone.
 */
export function formatTxTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
