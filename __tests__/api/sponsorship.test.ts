/**
 * @jest-environment node
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { NextRequest } from "next/server";

import {
  countSponsorshipsThisMonth,
  DEFAULT_MONTHLY_SPONSORSHIP_LIMIT,
  evaluateSponsorshipBudget,
  getMonthlySponsorshipLimit,
  isEligibleForSponsorship,
  SPONSORSHIP_AUDIT_ACTION,
  startOfMonthUtc,
  validateInnerTransaction,
} from "@/app/api/lib/sponsorshipPolicy";
import { POST as sponsorPOST } from "@/app/api/sponsorship/sponsor/route";
import { auth } from "@/app/lib/auth";
import { createAuditEvent } from "@/app/lib/auditLog";
import { prisma } from "@/app/lib/prisma";
import { buildFeeBumpedTx, fetchAccountXlmStatus } from "@/app/lib/stellarTransaction";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    auditLog: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/app/lib/auditLog", () => ({
  createAuditEvent: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/app/lib/stellarTransaction", () => {
  const actual = jest.requireActual("@/app/lib/stellarTransaction");
  return { ...actual, fetchAccountXlmStatus: jest.fn() };
});

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const NFT_CONTRACT_ID = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 7));
const OTHER_CONTRACT_ID = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 9));

const user = StellarSdk.Keypair.random();
const sponsor = StellarSdk.Keypair.random();

function buildTx(
  ops: StellarSdk.xdr.Operation[],
  { source = user.publicKey(), sign = true, fee = "100" } = {}
): StellarSdk.Transaction {
  const builder = new StellarSdk.TransactionBuilder(new StellarSdk.Account(source, "1"), {
    fee,
    networkPassphrase: PASSPHRASE,
  });
  ops.forEach((op) => builder.addOperation(op));
  const tx = builder.setTimeout(30).build();
  if (sign) tx.sign(user);
  return tx;
}

const paymentOp = () =>
  StellarSdk.Operation.payment({
    destination: StellarSdk.Keypair.random().publicKey(),
    asset: StellarSdk.Asset.native(),
    amount: "1",
  });

const mintOp = (contractId = NFT_CONTRACT_ID, fn = "mint") =>
  new StellarSdk.Contract(contractId).call(
    fn,
    StellarSdk.Address.fromString(user.publicKey()).toScVal(),
    StellarSdk.nativeToScVal("Clip", { type: "string" })
  );

const xdrOf = (tx: StellarSdk.Transaction) => tx.toEnvelope().toXDR("base64");

describe("Fee sponsorship (Issues #1220, #1223)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateInnerTransaction — allowed operations", () => {
    it("accepts a signed payment from the user", () => {
      const result = validateInnerTransaction(xdrOf(buildTx([paymentOp()])), user.publicKey(), "testnet", NFT_CONTRACT_ID);
      expect(result).toMatchObject({ ok: true, operations: ["payment"] });
    });

    it("accepts a trustline change", () => {
      const op = StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset("USDC", StellarSdk.Keypair.random().publicKey()),
      });
      const result = validateInnerTransaction(xdrOf(buildTx([op])), user.publicKey(), "testnet", NFT_CONTRACT_ID);
      expect(result).toMatchObject({ ok: true, operations: ["trustline"] });
    });

    it("accepts a mint on the platform NFT contract", () => {
      const result = validateInnerTransaction(xdrOf(buildTx([mintOp()])), user.publicKey(), "testnet", NFT_CONTRACT_ID);
      expect(result).toMatchObject({ ok: true, operations: ["mint"] });
    });

    it("rejects contract calls to another contract or function", () => {
      for (const op of [mintOp(OTHER_CONTRACT_ID), mintOp(NFT_CONTRACT_ID, "burn")]) {
        const result = validateInnerTransaction(xdrOf(buildTx([op])), user.publicKey(), "testnet", NFT_CONTRACT_ID);
        expect(result).toMatchObject({ ok: false, code: "OPERATION_NOT_ALLOWED" });
      }
    });

    it("rejects operations outside the allow-list", () => {
      const op = StellarSdk.Operation.manageData({ name: "k", value: "v" });
      const result = validateInnerTransaction(xdrOf(buildTx([op])), user.publicKey(), "testnet", NFT_CONTRACT_ID);
      expect(result).toMatchObject({ ok: false, code: "OPERATION_NOT_ALLOWED" });
    });

    it("rejects unsigned transactions", () => {
      const result = validateInnerTransaction(
        xdrOf(buildTx([paymentOp()], { sign: false })),
        user.publicKey(),
        "testnet",
        NFT_CONTRACT_ID
      );
      expect(result).toMatchObject({ ok: false, code: "UNSIGNED" });
    });

    it("rejects transactions sourced from another account", () => {
      const other = StellarSdk.Keypair.random().publicKey();
      const result = validateInnerTransaction(
        xdrOf(buildTx([paymentOp()], { source: other })),
        user.publicKey(),
        "testnet",
        NFT_CONTRACT_ID
      );
      expect(result).toMatchObject({ ok: false, code: "SOURCE_MISMATCH" });
    });

    it("rejects malformed XDR", () => {
      const result = validateInnerTransaction("not-xdr", user.publicKey(), "testnet", NFT_CONTRACT_ID);
      expect(result).toMatchObject({ ok: false, code: "INVALID_XDR" });
    });
  });

  describe("isEligibleForSponsorship", () => {
    it("is eligible when spendable XLM cannot cover the fee", () => {
      expect(isEligibleForSponsorship({ exists: true, balance: 1, minReserve: 1, spendable: 0 }, 100)).toBe(true);
    });

    it("is eligible when the balance is below the minimum reserve", () => {
      expect(isEligibleForSponsorship({ exists: true, balance: 0.8, minReserve: 1, spendable: 0 }, 100)).toBe(true);
    });

    it("is not eligible when the user can pay the fee", () => {
      expect(isEligibleForSponsorship({ exists: true, balance: 10, minReserve: 1, spendable: 9 }, 100)).toBe(false);
    });
  });

  describe("monthly budget", () => {
    it("defaults to 10 sponsorships per month", () => {
      expect(getMonthlySponsorshipLimit({})).toBe(DEFAULT_MONTHLY_SPONSORSHIP_LIMIT);
      expect(DEFAULT_MONTHLY_SPONSORSHIP_LIMIT).toBe(10);
    });

    it("reads SPONSORSHIP_MONTHLY_LIMIT and ignores invalid values", () => {
      expect(getMonthlySponsorshipLimit({ SPONSORSHIP_MONTHLY_LIMIT: "3" })).toBe(3);
      expect(getMonthlySponsorshipLimit({ SPONSORSHIP_MONTHLY_LIMIT: "abc" })).toBe(10);
      expect(getMonthlySponsorshipLimit({ SPONSORSHIP_MONTHLY_LIMIT: "-1" })).toBe(10);
    });

    it("allows requests under the limit and blocks at the limit", () => {
      expect(evaluateSponsorshipBudget(9, 10)).toEqual({ allowed: true, used: 9, limit: 10, remaining: 1 });
      expect(evaluateSponsorshipBudget(10, 10)).toEqual({ allowed: false, used: 10, limit: 10, remaining: 0 });
    });

    it("counts successful sponsorships since the start of the UTC month", async () => {
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(4);
      const now = new Date("2026-10-21T12:00:00Z");

      await expect(countSponsorshipsThisMonth("user-1", now)).resolves.toBe(4);
      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          actorId: "user-1",
          action: SPONSORSHIP_AUDIT_ACTION,
          status: "success",
          timestamp: { gte: new Date("2026-10-01T00:00:00Z") },
        },
      });
      expect(startOfMonthUtc(now).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    });
  });

  describe("buildFeeBumpedTx — XDR signing", () => {
    it("wraps the inner transaction and signs the envelope with the sponsor key", () => {
      const inner = buildTx([paymentOp(), paymentOp()]);
      const feeBump = buildFeeBumpedTx(inner, sponsor, { network: "testnet" });

      expect(feeBump.feeSource).toBe(sponsor.publicKey());
      expect(feeBump.innerTransaction.hash().equals(inner.hash())).toBe(true);
      expect(Number(feeBump.fee)).toBeGreaterThanOrEqual(100 * (inner.operations.length + 1));
      expect(feeBump.signatures).toHaveLength(1);
      expect(sponsor.verify(feeBump.hash(), feeBump.signatures[0].signature())).toBe(true);
    });

    it("accepts base64 XDR and round-trips as a fee-bump envelope", () => {
      const feeBump = buildFeeBumpedTx(xdrOf(buildTx([paymentOp()])), sponsor, { network: "testnet" });
      const decoded = StellarSdk.TransactionBuilder.fromXDR(feeBump.toEnvelope().toXDR("base64"), PASSPHRASE);
      expect(decoded).toBeInstanceOf(StellarSdk.FeeBumpTransaction);
    });

    it("pays at least the inner transaction's fee rate", () => {
      const inner = buildTx([paymentOp()], { fee: "500" });
      const feeBump = buildFeeBumpedTx(inner, sponsor, { network: "testnet" });
      expect(Number(feeBump.fee)).toBeGreaterThanOrEqual(500 * 2);
    });

    it("refuses to wrap an existing fee-bump", () => {
      const feeBump = buildFeeBumpedTx(buildTx([paymentOp()]), sponsor, { network: "testnet" });
      expect(() =>
        buildFeeBumpedTx(feeBump.toEnvelope().toXDR("base64"), sponsor, { network: "testnet" })
      ).toThrow("already fee-bumped");
    });
  });

  describe("POST /api/sponsorship/sponsor", () => {
    const mockAuth = auth as jest.Mock;
    const mockStatus = fetchAccountXlmStatus as jest.Mock;
    const originalEnv = { ...process.env };

    const request = (body: unknown) =>
      new NextRequest("http://localhost/api/sponsorship/sponsor", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

    beforeEach(() => {
      process.env.SPONSOR_SECRET_KEY = sponsor.secret();
      delete process.env.SPONSORSHIP_MONTHLY_LIMIT;
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      mockStatus.mockResolvedValue({ exists: true, balance: 1, minReserve: 1, spendable: 0 });
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await sponsorPOST(request({ innerXdr: "x", publicKey: user.publicKey() }));
      expect(res.status).toBe(401);
    });

    it("returns a sponsor-signed fee-bump XDR and audits it", async () => {
      const res = await sponsorPOST(
        request({ innerXdr: xdrOf(buildTx([paymentOp()])), publicKey: user.publicKey() })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const decoded = StellarSdk.TransactionBuilder.fromXDR(body.data.feeBumpXdr, PASSPHRASE);
      expect(decoded).toBeInstanceOf(StellarSdk.FeeBumpTransaction);
      expect((decoded as StellarSdk.FeeBumpTransaction).feeSource).toBe(sponsor.publicKey());
      expect(body.data.remaining).toBe(9);
      expect(createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: SPONSORSHIP_AUDIT_ACTION, status: "success", actorId: "user-1" })
      );
    });

    it("rejects users who can pay their own fee", async () => {
      mockStatus.mockResolvedValue({ exists: true, balance: 50, minReserve: 1, spendable: 49 });
      const res = await sponsorPOST(
        request({ innerXdr: xdrOf(buildTx([paymentOp()])), publicKey: user.publicKey() })
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("NOT_ELIGIBLE");
    });

    it("enforces the monthly budget", async () => {
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(10);
      const res = await sponsorPOST(
        request({ innerXdr: xdrOf(buildTx([paymentOp()])), publicKey: user.publicKey() })
      );
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("BUDGET_EXCEEDED");
      expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    });

    it("returns 503 when SPONSOR_SECRET_KEY is missing", async () => {
      delete process.env.SPONSOR_SECRET_KEY;
      const res = await sponsorPOST(
        request({ innerXdr: xdrOf(buildTx([paymentOp()])), publicKey: user.publicKey() })
      );
      expect(res.status).toBe(503);
    });
  });
});
