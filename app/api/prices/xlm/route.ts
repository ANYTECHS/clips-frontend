import { NextResponse } from "next/server";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_PRICE =
  parseFloat(process.env.NEXT_PUBLIC_XLM_FALLBACK_PRICE_USD ?? "0.12");

interface CacheEntry {
  price: number;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return NextResponse.json({ price: cache.price, stale: false });
  }

  try {
    const res = await fetch(COINGECKO_URL, { cache: "no-store" });

    if (res.status === 429) {
      if (cache) return NextResponse.json({ price: cache.price, stale: true });
      return NextResponse.json({ price: FALLBACK_PRICE, stale: true });
    }

    if (res.ok) {
      const data = await res.json();
      const price: unknown = data?.stellar?.usd;
      if (typeof price === "number") {
        cache = { price, expiresAt: now + CACHE_TTL_MS };
        return NextResponse.json({ price, stale: false });
      }
    }
  } catch {
    // network error
  }

  if (cache) return NextResponse.json({ price: cache.price, stale: true });
  return NextResponse.json({ price: FALLBACK_PRICE, stale: true });
}

/** Exported for tests only */
export function _resetCache() {
  cache = null;
}
