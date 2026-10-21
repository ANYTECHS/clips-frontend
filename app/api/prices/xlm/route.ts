import { NextResponse } from "next/server";
import { PRICE_CACHE_TTL_MS } from "@/app/lib/constants";
import { cachedJson } from "@/app/lib/responseCache";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
const CACHE_TTL_MS = PRICE_CACHE_TTL_MS;
export { CACHE_TTL_MS };
const FALLBACK_PRICE =
  parseFloat(process.env.NEXT_PUBLIC_XLM_FALLBACK_PRICE_USD ?? "0.12");

interface CacheEntry {
  price: number;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

export async function GET(request?: Request) {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return cachedJson(request, { price: cache.price, stale: false }, { maxAge: 30, sMaxAge: 60 });
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
        return cachedJson(request, { price, stale: false }, { maxAge: 30, sMaxAge: 60 });
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
