/**
 * Dashboard layout — Server Component.
 *
 * Responsibilities:
 *  1. Read the session via auth() — the only server-side auth call needed
 *     for the entire dashboard subtree.
 *  2. Redirect unauthenticated visitors to /login before any child renders,
 *     eliminating the client-side flash that the previous "use client" layout
 *     caused (AuthProvider would redirect one frame after mount).
 *  3. Render <DashboardShell> — the "use client" interactive wrapper that
 *     owns sidebar state, service-health polling, and the degraded banner.
 *
 * This file intentionally has NO "use client" directive so Next.js can:
 *  - Stream the layout HTML before JS bundles are parsed
 *  - Cache the shell across navigations at the segment level
 *  - Avoid including auth/session logic in any client bundle
 */

import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Hard-redirect unauthenticated visitors server-side.
  // This replaces the previous client-side redirect in AuthProvider and
  // eliminates a full round-trip + hydration before the user is sent to /login.
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}

// Re-export useSidebar so existing consumers that import it from the layout
// path continue to work without changes.
export { useSidebar } from "./DashboardShell";
