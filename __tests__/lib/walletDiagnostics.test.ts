/**
 * @jest-environment node
 *
 * Unit tests for app/lib/walletDiagnostics.ts — each check is exercised for
 * pass, fail and timeout outcomes.
 */
import { StrKey } from "@stellar/stellar-sdk";

import {
  checkContract,
  checkRpc,
  minimumReserve,
  runWalletDiagnostics,
  type DiagnosticCheck,
} from "@/app/lib/walletDiagnostics";

const PUBLIC_KEY = "GA" + "A".repeat(54);
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const NFT_ASSET = { code: "CLIPNFT", issuer: "GB" + "B".repeat(54) };

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Routes requests: Horizon account lookups vs Soroban RPC methods. */
function makeFetch(handlers: {
  account?: Handler;
  getHealth?: Handler;
  getLedgerEntries?: Handler;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/accounts/")) {
      return handlers.account ? handlers.account(url, init) : json({}, 404);
    }
    const method = JSON.parse(String(init?.body ?? "{}")).method as string;
    const handler = method === "getHealth" ? handlers.getHealth : handlers.getLedgerEntries;
    return handler ? handler(url, init) : json({ result: {} });
  }) as typeof fetch;
}

/** Never resolves until aborted — simulates a hung endpoint. */
const hang: Handler = (_url, init) =>
  new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });

const healthyAccount = {
  subentry_count: 1,
  balances: [
    { asset_type: "native", balance: "100.0000000" },
    {
      asset_type: "credit_alphanum12",
      asset_code: NFT_ASSET.code,
      asset_issuer: NFT_ASSET.issuer,
      balance: "0",
    },
  ],
};

const allPass = {
  account: () => json(healthyAccount),
  getHealth: () => json({ result: { status: "healthy" } }),
  getLedgerEntries: () => json({ result: { entries: [{ xdr: "AAAA" }] } }),
};

function byId(checks: DiagnosticCheck[], id: DiagnosticCheck["id"]) {
  return checks.find((c) => c.id === id)!;
}

function run(handlers: Parameters<typeof makeFetch>[0], extra: { timeoutMs?: number } = {}) {
  return runWalletDiagnostics({
    publicKey: PUBLIC_KEY,
    network: "testnet",
    nftAsset: NFT_ASSET,
    contractId: CONTRACT_ID,
    fetchImpl: makeFetch(handlers),
    timeoutMs: extra.timeoutMs ?? 1_000,
  });
}

describe("runWalletDiagnostics", () => {
  it("passes every check for a healthy wallet", async () => {
    const report = await run(allPass);
    expect(report.healthy).toBe(true);
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ["rpc", "pass"],
      ["account", "pass"],
      ["balance", "pass"],
      ["trustline", "pass"],
      ["contract", "pass"],
    ]);
  });

  describe("rpc", () => {
    it("fails when RPC reports unhealthy", async () => {
      const report = await run({ ...allPass, getHealth: () => json({ result: { status: "down" } }) });
      expect(byId(report.checks, "rpc").status).toBe("fail");
      expect(report.healthy).toBe(false);
    });

    it("fails with timedOut when RPC hangs", async () => {
      const report = await run({ ...allPass, getHealth: hang }, { timeoutMs: 20 });
      const rpc = byId(report.checks, "rpc");
      expect(rpc.status).toBe("fail");
      expect(rpc.timedOut).toBe(true);
      expect(rpc.message).toMatch(/timed out/i);
      expect(rpc.fix?.kind).toBe("retry");
    });
  });

  describe("account / balance", () => {
    it("fails account and balance with a Fund fix when the account does not exist", async () => {
      const report = await run({ ...allPass, account: () => json({}, 404) });
      expect(byId(report.checks, "account").status).toBe("fail");
      expect(byId(report.checks, "account").fix).toEqual({ kind: "fund", label: "Fund account" });
      expect(byId(report.checks, "balance").status).toBe("fail");
      expect(byId(report.checks, "trustline").status).toBe("skipped");
    });

    it("fails balance when below the minimum reserve", async () => {
      const report = await run({
        ...allPass,
        account: () =>
          json({ ...healthyAccount, balances: [{ asset_type: "native", balance: "1.0" }] }),
      });
      expect(byId(report.checks, "account").status).toBe("pass");
      const balance = byId(report.checks, "balance");
      expect(balance.status).toBe("fail");
      expect(balance.message).toMatch(/1\.5 XLM minimum reserve/);
      expect(balance.fix?.kind).toBe("fund");
    });

    it("fails account with timedOut when Horizon hangs", async () => {
      const report = await run({ ...allPass, account: hang }, { timeoutMs: 20 });
      expect(byId(report.checks, "account").timedOut).toBe(true);
      expect(byId(report.checks, "balance").status).toBe("skipped");
    });
  });

  describe("trustline", () => {
    it("fails with an Add trustline fix when missing", async () => {
      const report = await run({
        ...allPass,
        account: () =>
          json({ ...healthyAccount, balances: [{ asset_type: "native", balance: "100" }] }),
      });
      const trustline = byId(report.checks, "trustline");
      expect(trustline.status).toBe("fail");
      expect(trustline.fix).toMatchObject({ kind: "link", label: "Add trustline" });
    });
  });

  describe("contract", () => {
    it("fails for an invalid contract ID without calling RPC", async () => {
      const check = await checkContract("not-a-contract", "testnet", 1_000, makeFetch({}));
      expect(check.status).toBe("fail");
      expect(check.message).toMatch(/not a valid contract/i);
    });

    it("fails when no contract ID is configured", async () => {
      const check = await checkContract(undefined, "testnet", 1_000, makeFetch({}));
      expect(check.status).toBe("fail");
    });

    it("fails when the contract instance is not found", async () => {
      const report = await run({
        ...allPass,
        getLedgerEntries: () => json({ result: { entries: [] } }),
      });
      expect(byId(report.checks, "contract").status).toBe("fail");
    });

    it("fails with timedOut when RPC hangs", async () => {
      const report = await run({ ...allPass, getLedgerEntries: hang }, { timeoutMs: 20 });
      expect(byId(report.checks, "contract").timedOut).toBe(true);
    });
  });
});

describe("checkRpc", () => {
  it("passes for a healthy RPC", async () => {
    const check = await checkRpc("testnet", 1_000, makeFetch(allPass));
    expect(check.status).toBe("pass");
  });
});

describe("minimumReserve", () => {
  it("computes (2 + subentries + sponsoring − sponsored) × 0.5", () => {
    expect(minimumReserve({ subentry_count: 0 })).toBe(1);
    expect(minimumReserve({ subentry_count: 3, num_sponsoring: 1, num_sponsored: 2 })).toBe(2);
  });
});
