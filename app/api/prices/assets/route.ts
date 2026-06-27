import { NextRequest, NextResponse } from "next/server";
import { PRICE_CACHE_TTL_MS } from "@/app/lib/constants";

// Map asset codes to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  USDC: "usd-coin",
  BTC: "bitcoin",
  ETH: "ethereum",
  XLM: "stellar",
};

interface CacheEntry {
  prices: Record<string, number>;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

export async function GET(request: NextRequest) {
  const codes = request.nextUrl.searchParams.get("codes")?.split(",").filter(Boolean) ?? [];
  if (codes.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    const prices = Object.fromEntries(
      codes.filter((c) => c in cache!.prices).map((c) => [c, cache!.prices[c]])
    );
    return NextResponse.json({ prices, stale: false });
  }

  const ids = [...new Set(codes.map((c) => COINGECKO_IDS[c.toUpperCase()]).filter(Boolean))];
  if (ids.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;
    const res = await fetch(url, { cache: "no-store" });

    if (res.ok) {
      const data = await res.json();
      const prices: Record<string, number> = {};
      for (const code of Object.keys(COINGECKO_IDS)) {
        const id = COINGECKO_IDS[code];
        if (typeof data?.[id]?.usd === "number") {
          prices[code] = data[id].usd;
        }
      }
      cache = { prices, expiresAt: now + PRICE_CACHE_TTL_MS };
      const result = Object.fromEntries(
        codes.filter((c) => c.toUpperCase() in prices).map((c) => [c, prices[c.toUpperCase()]])
      );
      return NextResponse.json({ prices: result, stale: false });
    }

    if (res.status === 429 && cache) {
      const stale = Object.fromEntries(
        codes.filter((c) => c.toUpperCase() in cache!.prices).map((c) => [c, cache!.prices[c.toUpperCase()]])
      );
      return NextResponse.json({ prices: stale, stale: true });
    }
  } catch {
    // network error — fall through to stale/empty
  }

  if (cache) {
    const stale = Object.fromEntries(
      codes.filter((c) => c.toUpperCase() in cache!.prices).map((c) => [c, cache!.prices[c.toUpperCase()]])
    );
    return NextResponse.json({ prices: stale, stale: true });
  }

  return NextResponse.json({ prices: {} });
}
