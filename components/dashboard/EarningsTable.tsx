"use client";

import React from "react";
import { Wallet } from "lucide-react";

export interface EarningsRow {
  id: string | number;
  senderAddress?: string | null;
  clipTitle?: string | null;
  amount: string | number;
  createdAt?: string | null;
  status?: string | null;
}

interface EarningsTableProps {
  rows: EarningsRow[];
  caption?: string;
}

function shortAddress(address?: string | null) {
  if (!address) return "—";
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: string | number) {
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 7 }) : String(amount);
}

/**
 * Issue #1241 — earnings list.
 * ≥768px (md): semantic table. <768px: stacked cards with labeled fields,
 * so there is no horizontal scroll on phones.
 */
export default function EarningsTable({ rows, caption = "Earnings history" }: EarningsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6 text-center">
        <p className="text-sm text-[#90A89C]">No earnings yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-4 sm:p-6">
      {/* Tablet / desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[#0e4d2a] text-start">
              {["From", "Clip", "Date", "Amount"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={`pb-3 pe-4 font-bold text-[#90A89C] uppercase tracking-wider text-[11px] ${h === "Amount" ? "text-end" : "text-start"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#0e4d2a]/40 last:border-0">
                <td className="py-3 pe-4 text-[#F4F7EF] font-mono">{shortAddress(row.senderAddress)}</td>
                <td className="py-3 pe-4 text-[#F4F7EF] truncate max-w-[280px]">{row.clipTitle || "—"}</td>
                <td className="py-3 pe-4 text-[#90A89C]">{formatDate(row.createdAt)}</td>
                <td className="py-3 text-end font-bold text-[#B6FF4A]">+{formatAmount(row.amount)} XLM</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="md:hidden space-y-3" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-[#0e4d2a] bg-[#042413] p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-[#B6FF4A]" />
                </div>
                <span className="text-[13px] font-bold text-[#F4F7EF] font-mono truncate">
                  {shortAddress(row.senderAddress)}
                </span>
              </div>
              <span className="text-[13px] font-bold text-[#B6FF4A] shrink-0">+{formatAmount(row.amount)} XLM</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-[#F4F7EF] truncate">{row.clipTitle || "—"}</span>
              <span className="text-[#90A89C] shrink-0">{formatDate(row.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
