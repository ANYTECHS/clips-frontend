import { NextRequest, NextResponse } from "next/server";
import { getHorizonUrl } from "@/app/lib/networkConfig";

interface HorizonEffect {
  type: string;
  amount?: string;
  created_at: string;
}

interface HorizonEffectsPage {
  _embedded: { records: HorizonEffect[] };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const publicKey = searchParams.get("publicKey");
  const days = Math.min(parseInt(searchParams.get("days") ?? "14", 10), 90);
  const network = searchParams.get("network") === "mainnet" ? "mainnet" : "testnet";

  if (!publicKey) {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }

  try {
    const horizonUrl = getHorizonUrl(network);
    const url = `${horizonUrl}/accounts/${encodeURIComponent(publicKey)}/effects?limit=200&order=desc`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ history: null });
    }

    const data: HorizonEffectsPage = await res.json();
    const records = data._embedded?.records ?? [];

    // Build a map of date -> net XLM change
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const dailyDeltas: Record<string, number> = {};

    for (const effect of records) {
      const ts = new Date(effect.created_at).getTime();
      if (ts < cutoff) break;
      if (!effect.amount) continue;

      const CREDIT = new Set(["account_credited", "trade"]);
      const DEBIT = new Set(["account_debited"]);
      const day = effect.created_at.slice(0, 10);

      if (CREDIT.has(effect.type)) {
        dailyDeltas[day] = (dailyDeltas[day] ?? 0) + parseFloat(effect.amount);
      } else if (DEBIT.has(effect.type)) {
        dailyDeltas[day] = (dailyDeltas[day] ?? 0) - parseFloat(effect.amount);
      }
    }

    // Build ordered array of days
    const history: number[] = [];
    let running = 0;
    const allDays: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      allDays.push(d.toISOString().slice(0, 10));
    }
    // Accumulate from oldest to newest
    for (const day of allDays) {
      running += dailyDeltas[day] ?? 0;
      history.push(running);
    }

    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: null });
  }
}
