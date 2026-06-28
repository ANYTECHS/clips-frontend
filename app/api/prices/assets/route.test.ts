import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/prices/assets", () => {
  it("does not return a hardcoded $0.10 price for USDC", async () => {
    // Mock CoinGecko returning a real USDC price
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ "usd-coin": { usd: 1.0 } }),
    } as Response);

    const req = new NextRequest("http://localhost/api/prices/assets?codes=USDC");
    const res = await GET(req);
    const body = await res.json();

    expect(body.prices.USDC).not.toBe(0.1);
    expect(body.prices.USDC).toBe(1.0);
  });

  it("returns empty prices when CoinGecko fails and no cache", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network error"));

    const req = new NextRequest("http://localhost/api/prices/assets?codes=USDC");
    const res = await GET(req);
    const body = await res.json();

    expect(body.prices).toEqual({});
  });
});
