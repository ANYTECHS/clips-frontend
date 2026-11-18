"use client";

interface EarningsChartProps {
  totalXlm: string;
}

export default function EarningsChart({ totalXlm }: EarningsChartProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const currentTotal = parseFloat(totalXlm) || 0;
  const data = days.map((day, index) => ({
    day,
    value: currentTotal * (index / (days.length - 1)) * 0.8,
  }));

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 280;
    const y = 96 - (item.value / (currentTotal || 1)) * 80;
    return { x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const areaPath = `M0,96 ${linePath} L280,96 Z`;

  return (
    <div className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4">
      <p className="text-[#90A89C] text-xs font-bold uppercase tracking-wider mb-4">
        Earnings This Week
      </p>
      <div className="relative h-64">
        <svg
          className="w-full h-full"
          viewBox="0 0 280 96"
          preserveAspectRatio="none"
          role="img"
          aria-label="Weekly earnings chart"
        >
          {[0, 48, 96].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="280"
              y2={y}
              stroke="rgba(14,77,42,0.6)"
              strokeWidth="1"
            />
          ))}
          <defs>
            <linearGradient id="analytics-earnings-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#39FF14" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#analytics-earnings-gradient)" opacity="0.35" />
          <path
            d={linePath}
            fill="none"
            stroke="#39FF14"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex justify-between">
          {data.map((item) => (
            <span key={item.day} className="text-[10px] text-[#90A89C] font-medium">
              {item.day}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
