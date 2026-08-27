import React from "react";
import Skeleton from "./Skeleton";

interface SkeletonTableProps {
  /** Number of placeholder rows. Defaults to 5. */
  rows?: number;
  /** Number of columns. Defaults to 6. */
  cols?: number;
  /** Whether to render a filter-bar placeholder above the table. */
  showFilterBar?: boolean;
}

/**
 * SkeletonTable — layout-matched placeholder for data tables.
 *
 * Renders a full table skeleton whose proportions mirror the real
 * EarningsTable so there is no layout shift when data arrives.
 *
 * Issue #871 – skeleton screens for slow-loading content.
 */
export default function SkeletonTable({
  rows = 5,
  cols = 6,
  showFilterBar = true,
}: SkeletonTableProps) {
  return (
    <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden" aria-busy="true" aria-label="Loading table data">
      {showFilterBar && (
        <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-white/5">
          <Skeleton className="h-9 flex-1 min-w-[180px] rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="ml-auto h-4 w-28 rounded" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="presentation">
          <thead>
            <tr className="border-b border-white/5">
              {Array.from({ length: cols }).map((_, j) => (
                <th key={j} className="px-5 py-3">
                  <Skeleton className="h-3 w-16 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-white/5">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <Skeleton
                      className="h-4 rounded"
                      style={{ width: `${60 + ((i * cols + j) % 4) * 10}%` } as React.CSSProperties}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
