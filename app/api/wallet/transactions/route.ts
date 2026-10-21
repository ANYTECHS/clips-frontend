/**
 * GET /api/wallet/transactions
 *
 * Cursor-paginated Stellar transaction history for an account, built from
 * Horizon's `/accounts/{id}/operations` endpoint (newest first).
 *
 * Query params:
 *   publicKey  (required) Stellar account id (G...)
 *   network    "testnet" (default) | "mainnet"
 *   cursor     Horizon paging token returned as `nextCursor` by a previous call
 *   limit      Page size, 1–100 (default 20)
 *   type       "payment" | "mint" | "trustline"
 *   asset      Asset code, e.g. "XLM"
 *   from / to  Inclusive date range, YYYY-MM-DD
 *
 * Response: { transactions: StellarTransaction[], nextCursor: string | null }
 */

import { NextRequest, NextResponse } from "next/server";

import { getHorizonUrl } from "@/app/lib/networkConfig";
import {
  DEFAULT_STELLAR_TX_LIMIT,
  filterStellarTransactions,
  type StellarTransaction,
  type StellarTxFilters,
  type StellarTxType,
} from "@/app/lib/txHistory";

const MAX_LIMIT = 100;
/** Upper bound on Horizon round-trips per request when filters skip rows. */
const MAX_HORIZON_PAGES = 5;
const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TX_TYPES: ReadonlySet<string> = new Set(["payment", "mint", "trustline"]);

interface HorizonOperation {
  id: string;
  paging_token: string;
  transaction_hash: string;
  transaction_successful: boolean;
  type: string;
  created_at: string;
  amount?: string;
  starting_balance?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  funder?: string;
  account?: string;
}

interface HorizonOperationsPage {
  _embedded?: { records?: HorizonOperation[] };
}

const PAYMENT_OPS = new Set([
  "payment",
  "path_payment_strict_receive",
  "path_payment_strict_send",
  "create_account",
]);

function classify(opType: string): StellarTxType {
  if (PAYMENT_OPS.has(opType)) return "payment";
  if (opType === "change_trust") return "trustline";
  // NFT mints are Soroban contract invocations.
  if (opType === "invoke_host_function") return "mint";
  return "other";
}

function assetCode(op: HorizonOperation): string {
  if (op.asset_type === "native" || op.type === "create_account") return "XLM";
  if (op.asset_code) return op.asset_code;
  if (op.type === "invoke_host_function") return "NFT";
  return "XLM";
}

function mapOperation(op: HorizonOperation, account: string): StellarTransaction {
  let counterparty: string | null = null;
  if (op.type === "create_account") {
    counterparty = op.funder === account ? (op.account ?? null) : (op.funder ?? null);
  } else if (op.from || op.to) {
    counterparty = op.from === account ? (op.to ?? null) : (op.from ?? null);
  } else if (op.type === "change_trust") {
    counterparty = op.asset_issuer ?? null;
  }

  return {
    id: op.id,
    hash: op.transaction_hash,
    type: classify(op.type),
    createdAt: op.created_at,
    amount: op.amount ?? op.starting_balance ?? null,
    asset: assetCode(op),
    counterparty,
    status: op.transaction_successful === false ? "failed" : "success",
    pagingToken: op.paging_token,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const publicKey = searchParams.get("publicKey") ?? "";
  const network = searchParams.get("network") === "mainnet" ? "mainnet" : "testnet";
  const cursor = searchParams.get("cursor");
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_STELLAR_TX_LIMIT), 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_STELLAR_TX_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  if (!STELLAR_ACCOUNT_RE.test(publicKey)) {
    return NextResponse.json({ error: "A valid Stellar publicKey is required" }, { status: 400 });
  }
  if (cursor !== null && !/^\d+$/.test(cursor)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (type && !TX_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  }

  const filters: StellarTxFilters = {
    type: (type as StellarTxType | null) ?? "all",
    asset: searchParams.get("asset") ?? undefined,
    from: from ?? undefined,
    to: to ?? undefined,
  };
  const fromMs = from ? Date.parse(`${from}T00:00:00.000Z`) : null;

  const horizonUrl = getHorizonUrl(network);
  const collected: StellarTransaction[] = [];
  let horizonCursor = cursor;
  let nextCursor: string | null = null;

  try {
    for (let i = 0; i < MAX_HORIZON_PAGES && collected.length < limit; i++) {
      const params = new URLSearchParams({ limit: String(limit), order: "desc" });
      if (horizonCursor) params.set("cursor", horizonCursor);
      const res = await fetch(
        `${horizonUrl}/accounts/${encodeURIComponent(publicKey)}/operations?${params.toString()}`,
        { cache: "no-store" }
      );

      if (res.status === 404) {
        // Unfunded account — no history yet.
        return NextResponse.json({ transactions: [], nextCursor: null });
      }
      if (!res.ok) {
        return NextResponse.json(
          { error: `Horizon request failed: ${res.status}` },
          { status: 502 }
        );
      }

      const data: HorizonOperationsPage = await res.json();
      const records = data._embedded?.records ?? [];
      if (records.length === 0) {
        nextCursor = null;
        break;
      }

      let reachedDateFloor = false;
      for (const op of records) {
        horizonCursor = op.paging_token;
        // Results are newest-first, so once we pass the `from` date nothing
        // older can match.
        if (fromMs !== null && Date.parse(op.created_at) < fromMs) {
          reachedDateFloor = true;
          break;
        }
        const [tx] = filterStellarTransactions([mapOperation(op, publicKey)], filters);
        if (tx) collected.push(tx);
        if (collected.length >= limit) break;
      }

      const exhausted = records.length < limit || reachedDateFloor;
      nextCursor = exhausted && collected.length < limit ? null : horizonCursor;
      if (exhausted) break;
    }

    return NextResponse.json({ transactions: collected, nextCursor });
  } catch {
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 502 });
  }
}
