/**
 * @jest-environment node
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { NextRequest } from "next/server";

import { DELETE as trustlineDELETE, GET as trustlineGET, POST as trustlinePOST } from "@/app/api/wallet/trustline/route";
import { auth } from "@/app/lib/auth";
import { assertChangeTrustTx, buildChangeTrustTx, submitEnvelope } from "@/app/lib/stellarTransaction";
import {
  buildTrustlineTransaction,
  fetchTrustlines,
  parseHorizonTrustlines,
  submitTrustlineTransaction,
  TrustlineApiError,
} from "@/app/lib/trustlineApi";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/app/lib/stellarTransaction", () => {
  const actual = jest.requireActual("@/app/lib/stellarTransaction");
  return { ...actual, buildChangeTrustTx: jest.fn(), submitEnvelope: jest.fn() };
});

const PASSPHRASE = StellarSdk.Networks.TESTNET;
const user = StellarSdk.Keypair.random();
const ISSUER = StellarSdk.Keypair.random().publicKey();

function changeTrustXdr({
  assetCode = "USDC",
  limit,
  source = user.publicKey(),
}: { assetCode?: string; limit?: string; source?: string } = {}) {
  const tx = new StellarSdk.TransactionBuilder(new StellarSdk.Account(source, "1"), {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(assetCode, ISSUER),
        ...(limit !== undefined ? { limit } : {}),
      })
    )
    .setTimeout(30)
    .build();
  tx.sign(user);
  return tx.toEnvelope().toXDR("base64");
}

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("Trustline API (Issue #1222)", () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    (auth as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // ─── Client request/response handling ──────────────────────────────────────

  describe("trustlineApi client", () => {
    it("fetchTrustlines requests the account's trustlines and unwraps data", async () => {
      const trustlines = [{ assetCode: "USDC", assetIssuer: ISSUER, balance: "1.0000000", limit: "100.0000000" }];
      mockFetch.mockResolvedValue(jsonResponse(200, { data: { trustlines }, error: null }));

      await expect(fetchTrustlines(user.publicKey(), "testnet")).resolves.toEqual(trustlines);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/wallet/trustline?publicKey=${user.publicKey()}&network=testnet`,
        expect.objectContaining({ cache: "no-store" })
      );
    });

    it("buildTrustlineTransaction POSTs for add and DELETEs for remove", async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { data: { xdr: "AAA", networkPassphrase: PASSPHRASE }, error: null }));
      const request = { publicKey: user.publicKey(), assetCode: "USDC", assetIssuer: ISSUER };

      await expect(buildTrustlineTransaction("add", request)).resolves.toEqual({
        xdr: "AAA",
        networkPassphrase: PASSPHRASE,
      });
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/wallet/trustline",
        expect.objectContaining({ method: "POST", body: JSON.stringify(request) })
      );

      await buildTrustlineTransaction("remove", request);
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/wallet/trustline",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("submitTrustlineTransaction returns the transaction hash", async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { data: { hash: "abc", ledger: 7 }, error: null }));
      await expect(
        submitTrustlineTransaction("add", {
          publicKey: user.publicKey(),
          assetCode: "USDC",
          assetIssuer: ISSUER,
          signedXdr: "signed",
        })
      ).resolves.toEqual({ hash: "abc", ledger: 7 });
    });

    it("maps error responses to TrustlineApiError with code and status", async () => {
      mockFetch.mockResolvedValue(jsonResponse(400, { error: "Bad issuer", code: "VALIDATION_ERROR" }));
      const promise = buildTrustlineTransaction("add", {
        publicKey: user.publicKey(),
        assetCode: "USDC",
        assetIssuer: "bad",
      });
      await expect(promise).rejects.toBeInstanceOf(TrustlineApiError);
      await expect(promise).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400, message: "Bad issuer" });
    });

    it("maps network failures to NETWORK_ERROR", async () => {
      mockFetch.mockRejectedValue(new Error("offline"));
      await expect(fetchTrustlines(user.publicKey(), "testnet")).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        status: 0,
      });
    });

    it("parseHorizonTrustlines keeps only credit assets", () => {
      expect(
        parseHorizonTrustlines([
          { asset_type: "native", balance: "10.0000000" },
          { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: ISSUER, balance: "2.0000000", limit: "50.0000000" },
          { asset_type: "liquidity_pool_shares", balance: "1.0000000" },
        ])
      ).toEqual([{ assetCode: "USDC", assetIssuer: ISSUER, balance: "2.0000000", limit: "50.0000000" }]);
    });
  });

  // ─── Signed transaction verification ──────────────────────────────────────

  describe("assertChangeTrustTx", () => {
    const expected = {
      sourcePublicKey: user.publicKey(),
      assetCode: "USDC",
      assetIssuer: ISSUER,
      network: "testnet" as const,
    };

    it("accepts a matching add", () => {
      expect(() => assertChangeTrustTx(changeTrustXdr(), { ...expected, action: "add" })).not.toThrow();
    });

    it("accepts a matching removal (limit 0)", () => {
      expect(() => assertChangeTrustTx(changeTrustXdr({ limit: "0" }), { ...expected, action: "remove" })).not.toThrow();
    });

    it("rejects a different asset, source or action", () => {
      expect(() => assertChangeTrustTx(changeTrustXdr({ assetCode: "EURC" }), { ...expected, action: "add" })).toThrow();
      expect(() =>
        assertChangeTrustTx(changeTrustXdr({ source: StellarSdk.Keypair.random().publicKey() }), { ...expected, action: "add" })
      ).toThrow();
      expect(() => assertChangeTrustTx(changeTrustXdr(), { ...expected, action: "remove" })).toThrow();
    });
  });

  // ─── Route handlers ───────────────────────────────────────────────────────

  describe("/api/wallet/trustline route", () => {
    const request = (method: string, body?: unknown, query = "") =>
      new NextRequest(`http://localhost/api/wallet/trustline${query}`, {
        method,
        ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
      });
    const baseBody = { publicKey: user.publicKey(), assetCode: "USDC", assetIssuer: ISSUER, network: "testnet" };

    it("returns 401 when unauthenticated", async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await trustlinePOST(request("POST", baseBody));
      expect(res.status).toBe(401);
    });

    it("validates the request body", async () => {
      const res = await trustlinePOST(request("POST", { ...baseBody, assetIssuer: "not-a-key" }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("VALIDATION_ERROR");
    });

    it("POST without signedXdr builds an add transaction", async () => {
      (buildChangeTrustTx as jest.Mock).mockResolvedValue("UNSIGNED_XDR");
      const res = await trustlinePOST(request("POST", { ...baseBody, limit: "1000" }));
      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual({ xdr: "UNSIGNED_XDR", networkPassphrase: PASSPHRASE });
      expect(buildChangeTrustTx).toHaveBeenCalledWith(
        expect.objectContaining({ action: "add", limit: "1000", sourcePublicKey: user.publicKey() })
      );
    });

    it("DELETE without signedXdr builds a remove transaction", async () => {
      (buildChangeTrustTx as jest.Mock).mockResolvedValue("UNSIGNED_XDR");
      await trustlineDELETE(request("DELETE", baseBody));
      expect(buildChangeTrustTx).toHaveBeenCalledWith(expect.objectContaining({ action: "remove" }));
    });

    it("POST with signedXdr verifies and submits the transaction", async () => {
      (submitEnvelope as jest.Mock).mockResolvedValue({ hash: "deadbeef", ledger: 42, successful: true });
      const signedXdr = changeTrustXdr();
      const res = await trustlinePOST(request("POST", { ...baseBody, signedXdr }));
      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual({ hash: "deadbeef", ledger: 42 });
      expect(submitEnvelope).toHaveBeenCalledWith(signedXdr, "testnet");
    });

    it("refuses to submit a signed transaction that does not match the request", async () => {
      const res = await trustlineDELETE(request("DELETE", { ...baseBody, signedXdr: changeTrustXdr() }));
      expect(res.status).toBe(400);
      expect(submitEnvelope).not.toHaveBeenCalled();
    });

    it("GET lists trustlines from Horizon", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          balances: [
            { asset_type: "native", balance: "5.0000000" },
            { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: ISSUER, balance: "0.0000000", limit: "10.0000000" },
          ],
        })
      );
      const res = await trustlineGET(request("GET", undefined, `?publicKey=${user.publicKey()}&network=testnet`));
      expect(res.status).toBe(200);
      expect((await res.json()).data.trustlines).toEqual([
        { assetCode: "USDC", assetIssuer: ISSUER, balance: "0.0000000", limit: "10.0000000" },
      ]);
    });
  });
});
