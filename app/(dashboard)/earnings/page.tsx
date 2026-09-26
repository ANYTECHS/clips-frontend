/**
 * Earnings page — Server Component.
 *
 * Fetches page 1 of transactions server-side so the browser receives real
 * data in the initial HTML. The EarningsPageClient island handles all
 * interactive features (pagination, filters, export) after hydration.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import EarningsLayout from "@/components/dashboard/EarningsLayout";
import EarningsPageClient from "./EarningsPageClient";
import { fetchEarningsTransactions, type EarningsPageData } from "@/app/lib/serverData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Earnings & Tax Report — ClipCash",
  description:
    "View your complete ClipCash earnings history, completed payouts, pending balances, and tax-ready transaction exports.",
  openGraph: {
    title: "Earnings & Tax Report — ClipCash",
    description:
      "Your complete ClipCash earnings history and tax-ready transaction exports.",
    url: "https://clipcash.ai/earnings",
  },
  robots: { index: false, follow: false },
};

export default async function EarningsPage() {
  const initialData: EarningsPageData | null = await fetchEarningsTransactions(1, 20);

  return (
    <EarningsLayout>
      <Suspense fallback={null}>
        <EarningsPageClient initialData={initialData} />
      </Suspense>
    </EarningsLayout>
  );
}
