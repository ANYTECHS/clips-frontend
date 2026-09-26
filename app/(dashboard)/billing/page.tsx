/**
 * Billing page — Server Component.
 *
 * Fetches plan definitions and the current user profile server-side so the
 * plan grid and usage bar render in the first HTML payload. Plan data is
 * cached for 1 hour (it changes rarely). The upgrade/checkout interaction
 * is handled by BillingPageClient after hydration.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import BillingPageClient from "./BillingPageClient";
import {
  fetchBillingPlans,
  fetchUserProfile,
} from "@/app/lib/serverData";
import type { UserProfile } from "@/app/store/types";
import type { BillingPlan } from "@/app/api/billing/plans/route";

// Plans are static (revalidated every hour); profile is per-user (no-store).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Fetch the profile here just for the metadata — the page fetch below also
  // calls it, but Next.js deduplicates identical fetch() calls within the same
  // render pass via its built-in request memoisation.
  const profile = await fetchUserProfile();
  const planLabel = profile?.plan
    ? `${profile.plan.charAt(0).toUpperCase()}${profile.plan.slice(1)}`
    : "Free";

  return {
    title: `Billing & Plans (${planLabel}) — ClipCash`,
    description:
      "Manage your ClipCash subscription, view your current plan quota, and upgrade to unlock higher AI transform limits and priority processing.",
    openGraph: {
      title: `Billing & Plans — ClipCash`,
      description:
        "Upgrade your ClipCash plan to unlock higher AI transform quotas, 4K/8K exports, and priority GPU processing.",
      url: "https://clipcash.ai/billing",
    },
    robots: { index: false, follow: false },
  };
}

export default async function BillingPage() {
  // Fetch plans and profile concurrently.
  const [plans, initialProfile]: [BillingPlan[], UserProfile | null] =
    await Promise.all([fetchBillingPlans(), fetchUserProfile()]);

  return (
    <Suspense fallback={null}>
      <BillingPageClient plans={plans} initialProfile={initialProfile} />
    </Suspense>
  );
}
