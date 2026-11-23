"use client";

import React from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Optional class for the header cell. */
  headerClassName?: string;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Accessible caption for the table. */
  caption?: string;
}

/**
 * Issue #1379 — responsive data table.
 * ≥sm breakpoint: semantic <table> with readable headers.
 * <sm breakpoint: stacked cards — each row becomes a card with labeled
 * fields (column headers preserved as field labels). No horizontal scroll.
 */
export default function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-[13px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-[#0e4d2a] text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`py-2 pr-4 font-bold text-[#90A89C] uppercase tracking-wider text-[11px] ${c.headerClassName ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-[#0e4d2a]/40 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className="py-3 pr-4 text-[#F4F7EF] align-top">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards with labeled fields */}
      <ul className="sm:hidden space-y-3">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-[#0e4d2a] bg-[#06351C]/60 p-4 space-y-2"
          >
            {columns.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#90A89C] shrink-0 pt-0.5">
                  {c.header}
                </span>
                <span className="text-[13px] text-[#F4F7EF] text-right">{c.render(row)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
