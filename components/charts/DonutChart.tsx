import React from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
}

export function DonutChart({ slices }: DonutChartProps) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const R = 60;
  const cx = 80;
  const cy = 80;
  const strokeWidth = 22;

  const { arcs } = slices.reduce<{ arcs: Array<DonutSlice & { pct: number; d: string }>; cumulative: number }>(
    (acc, slice) => {
      const pct = slice.value / total;
      const startAngle = acc.cumulative * 2 * Math.PI - Math.PI / 2;
      const nextCumulative = acc.cumulative + pct;
      const endAngle = nextCumulative * 2 * Math.PI - Math.PI / 2;

      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);
      const largeArc = pct > 0.5 ? 1 : 0;

      acc.arcs.push({
        ...slice,
        pct,
        d: `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
      });
      
      acc.cumulative = nextCumulative;
      return acc;
    },
    { arcs: [], cumulative: 0 }
  );

  return (
    <svg viewBox="0 0 160 160" className="w-full max-w-[160px]" aria-hidden="true">
      {arcs.map((arc) => (
        <path
          key={arc.label}
          d={arc.d}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="13" fontWeight="800">
        {slices[0] ? `${(slices[0].pct * 100).toFixed(0)}%` : ""}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#8d97ac" fontSize="9" fontWeight="600">
        {slices[0]?.label ?? ""}
      </text>
    </svg>
  );
}

export default DonutChart;
