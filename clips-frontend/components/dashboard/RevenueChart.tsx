"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

type Range = "6M" | "7D" | "30D" | "90D";

interface MonthPoint {
  label: string;
  ads: number;
  tips: number;
}

const DATA_6M: MonthPoint[] = [
  { label: "Nov", ads: 3200, tips: 1100 },
  { label: "Dec", ads: 4800, tips: 1600 },
  { label: "Jan", ads: 3900, tips: 1350 },
  { label: "Feb", ads: 5200, tips: 2100 },
  { label: "Mar", ads: 4600, tips: 1800 },
  { label: "Apr", ads: 6100, tips: 2400 },
];

const DATA_LEGACY: Record<Exclude<Range, "6M">, { label: string; value: number }[]> = {
  "7D": [
    { label: "MON", value: 820 },
    { label: "TUE", value: 940 },
    { label: "WED", value: 880 },
    { label: "THU", value: 1240 },
    { label: "FRI", value: 1100 },
    { label: "SAT", value: 1380 },
    { label: "SUN", value: 1290 },
  ],
  "30D": [
    { label: "W1", value: 3200 },
    { label: "W2", value: 4100 },
    { label: "W3", value: 3750 },
    { label: "W4", value: 5400 },
  ],
  "90D": [
    { label: "JAN", value: 9800 },
    { label: "FEB", value: 12400 },
    { label: "MAR", value: 11200 },
  ],
};

const RANGE_LABELS: Record<Range, string> = {
  "6M": "Last 6 Months",
  "7D": "Last 7 Days",
  "30D": "Last 30 Days",
  "90D": "Last 90 Days",
};

const COLOR_ADS  = "#00E58F";
const COLOR_TIPS = "#3B82F6";

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;

// ── Grouped Bar Chart (6M) ────────────────────────────────────────────────────

const SVG_W = 700;
const SVG_H = 200;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

function BarChart({ data }: { data: MonthPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const chartW = SVG_W - PAD_L - PAD_R;
  const chartH = SVG_H - PAD_T - PAD_B;
  const maxVal = Math.max(...data.flatMap((d) => [d.ads, d.tips]));
  const yMax   = Math.ceil(maxVal / 1000) * 1000 || 1000;
  const n      = data.length;
  const groupW = chartW / n;
  const barW   = Math.min(groupW * 0.28, 28);
  const gap    = barW * 0.4;
  const toY    = (v: number) => PAD_T + chartH - (v / yMax) * chartH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: PAD_T + chartH * (1 - t),
    label: fmt(yMax * t),
  }));

  return (
    <div className="relative w-full" style={{ minHeight: SVG_H + 8 }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ height: SVG_H }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="gradAds" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_ADS} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR_ADS} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="gradTips" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_TIPS} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR_TIPS} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="gradHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {ticks.map((t) => (
          <g key={t.y}>
            <line x1={PAD_L} y1={t.y} x2={SVG_W - PAD_R} y2={t.y}
              stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
            <text x={PAD_L - 6} y={t.y + 4} textAnchor="end"
              fontSize="10" fill="#4A5D54" fontFamily="inherit">
              {t.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const groupX = PAD_L + i * groupW + groupW / 2;
          const adsX   = groupX - gap / 2 - barW;
          const tipsX  = groupX + gap / 2;
          const adsY   = toY(d.ads);
          const tipsY  = toY(d.tips);
          const adsH   = chartH - (adsY - PAD_T);
          const tipsH  = chartH - (tipsY - PAD_T);
          const isHov  = hovered === i;
          const baseY  = PAD_T + chartH;
          const ttY    = Math.min(adsY, tipsY) - 52;

          return (
            <g key={d.label}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}>

              {isHov && (
                <rect x={PAD_L + i * groupW + 4} y={PAD_T}
                  width={groupW - 8} height={chartH}
                  rx="6" fill="url(#gradHover)" />
              )}

              <rect x={adsX} y={adsY} width={barW} height={adsH}
                rx="4" fill="url(#gradAds)" opacity={isHov ? 1 : 0.85} />

              <rect x={tipsX} y={tipsY} width={barW} height={tipsH}
                rx="4" fill="url(#gradTips)" opacity={isHov ? 1 : 0.85} />

              {isHov && (
                <g>
                  <rect x={groupX - 52} y={ttY} width={104} height={46}
                    rx="8" fill="#1A1A1A"
                    stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
                  <text x={groupX} y={ttY + 16} textAnchor="middle"
                    fontSize="10" fill={COLOR_ADS} fontFamily="inherit" fontWeight="600">
                    Ads {fmt(d.ads)}
                  </text>
                  <text x={groupX} y={ttY + 32} textAnchor="middle"
                    fontSize="10" fill={COLOR_TIPS} fontFamily="inherit" fontWeight="600">
                    Tips {fmt(d.tips)}
                  </text>
                </g>
              )}

              <text x={groupX} y={baseY + 18} textAnchor="middle"
                fontSize="11" fontWeight="700"
                fill={isHov ? "#ffffff" : "#4A5D54"}
                fontFamily="inherit">
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={PAD_L} y1={PAD_T + chartH} x2={SVG_W - PAD_R} y2={PAD_T + chartH}
          stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ── Legacy Line Chart (7D / 30D / 90D) ───────────────────────────────────────

const LC_W  = 700;
const LC_H  = 180;
const LC_PX = 10;
const LC_PY = 20;

function buildLinePaths(points: { label: string; value: number }[]) {
  const values = points.map((p) => p.value);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;
  const n      = points.length;
  const xs     = points.map((_, i) => LC_PX + (i / (n - 1)) * (LC_W - LC_PX * 2));
  const ys     = values.map((v) => LC_PY + (1 - (v - min) / range) * (LC_H - LC_PY * 2));
  let line     = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const cpx = (xs[i - 1] + xs[i]) / 2;
    line += ` C ${cpx} ${ys[i - 1]}, ${cpx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const fill = line + ` L ${xs[n - 1]} ${LC_H} L ${xs[0]} ${LC_H} Z`;
  return { line, fill, xs, ys };
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const { line, fill, xs, ys } = buildLinePaths(data);
  const peakIdx = ys.indexOf(Math.min(...ys));
  return (
    <div className="relative w-full" style={{ minHeight: 200 }}>
      <svg viewBox={`0 0 ${LC_W} ${LC_H}`} className="w-full"
        style={{ height: 160 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_ADS} stopOpacity="0.18" />
            <stop offset="100%" stopColor={COLOR_ADS} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLOR_ADS} stopOpacity="0.2" />
            <stop offset="40%" stopColor={COLOR_ADS} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR_ADS} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#revFill)" />
        <path d={line} fill="none" stroke="url(#revLine)"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]}
              r={i === peakIdx ? 5 : 3}
              fill={i === peakIdx ? COLOR_ADS : "#1A1A1A"}
              stroke={COLOR_ADS}
              strokeWidth={i === peakIdx ? 0 : 1.5}
              opacity={i === peakIdx ? 1 : 0.5} />
            {i === peakIdx && (
              <line x1={x} y1={ys[i] + 6} x2={x} y2={LC_H}
                stroke={COLOR_ADS} strokeWidth="1"
                strokeDasharray="4 4" opacity="0.25" />
            )}
          </g>
        ))}
      </svg>
      <div className="flex justify-between w-full mt-3"
        style={{ paddingLeft: LC_PX, paddingRight: LC_PX }}>
        {data.map((d, i) => (
          <span key={d.label}
            className={`text-[11px] font-bold tracking-wider ${
              i === peakIdx ? "text-brand" : "text-[#4A5D54]"
            }`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RevenueChart() {
  const [range, setRange] = useState<Range>("6M");
  const [open, setOpen]   = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const is6M      = range === "6M";
  const totalAds  = DATA_6M.reduce((s, d) => s + d.ads, 0);
  const totalTips = DATA_6M.reduce((s, d) => s + d.tips, 0);
  const legacyPeak = !is6M
    ? Math.max(...DATA_LEGACY[range as Exclude<Range, "6M">].map((d) => d.value))
    : 0;

  return (
    <div className="bg-[#111111] border border-white/5 rounded-[24px] p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden group hover:border-brand/10 transition-all duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-[18px] font-bold text-white tracking-tight">
            Revenue Trend
          </h3>
          {is6M ? (
            <p className="text-[#5A6F65] text-[12px] font-medium">
              Ads{" "}
              <span className="text-brand">{fmt(totalAds)}</span>
              {"  ·  "}
              Tips{" "}
              <span className="text-[#3B82F6]">{fmt(totalTips)}</span>
            </p>
          ) : (
            <p className="text-[#5A6F65] text-[12px] font-medium">
              Peak: <span className="text-brand">{fmt(legacyPeak)}</span>
            </p>
          )}
        </div>

        {/* Range Picker */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-white/5 rounded-xl text-[13px] text-[#8e9895] hover:text-white transition-colors"
          >
            {RANGE_LABELS[range]}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl overflow-hidden z-20 min-w-[150px] shadow-xl">
              {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    r === range
                      ? "text-brand bg-brand/5"
                      : "text-[#8e9895] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend (6M only) */}
      {is6M && (
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#8e9895]">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_ADS }} />
            Platform Ads
          </span>
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#8e9895]">
            <span className="w-3 h-3 rounded-sm" style={{ background: COLOR_TIPS }} />
            Direct Tips
          </span>
        </div>
      )}

      {/* Chart */}
      {is6M
        ? <BarChart data={DATA_6M} />
        : <LineChart data={DATA_LEGACY[range as Exclude<Range, "6M">]} />
      }

      {/* Bottom glow on hover */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </div>
  );
}
