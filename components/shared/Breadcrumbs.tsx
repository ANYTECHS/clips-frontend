"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  clips: "Clips",
  "ai-projects": "AI Projects",
  "agent-marketplace": "Agent Marketplace",
  settings: "Settings",
  platforms: "Platforms",
  analytics: "Analytics",
  earnings: "Earnings",
  wallet: "Wallet",
  processing: "Processing",
};

function humanize(segment: string): string {
  return LABELS[segment] ?? segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Issue #1383 — breadcrumb navigation for nested dashboard routes.
 * Last segment is the current page (rendered as text, not a link).
 * Screen-reader labeled via nav[aria-label="Breadcrumb"] + aria-current.
 */
export default function Breadcrumbs({ items }: { items?: Crumb[] }) {
  const pathname = usePathname();

  const crumbs: Crumb[] =
    items ??
    pathname
      .split("/")
      .filter(Boolean)
      .map((seg, i, arr) => ({
        label: humanize(seg),
        href: i === arr.length - 1 ? undefined : `/${arr.slice(0, i + 1).join("/")}`,
      }));

  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-[12px] text-[#90A89C] flex-wrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.label + i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className="text-[#F4F7EF] font-semibold">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-[#B6FF4A] transition-colors">
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
