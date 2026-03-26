"use client";

const METRICS = [
  {
    label: "Clips Generated",
    value: "1,284",
    delta: "+124 this week",
    positive: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
    accent: "#22C55E",
  },
  {
    label: "Total Views",
    value: "2.4M",
    delta: "+18% vs last month",
    positive: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    accent: "#38BDF8",
  },
  {
    label: "Revenue",
    value: "$3,820",
    delta: "+$420 this week",
    positive: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    accent: "#A78BFA",
  },
  {
    label: "NFTs Minted",
    value: "38",
    delta: "+5 today",
    positive: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    accent: "#FB923C",
  },
];

export default function MetricsCards() {
  return (

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
      {METRICS.map((m, i) => (
        <div
          key={m.label}
          className="relative flex flex-col gap-3 p-5 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            animationDelay: `${i * 80}ms`,
          }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between">
            <span
              className="p-2 rounded-xl"
              style={{ background: `${m.accent}18`, color: m.accent }}
            >
              {m.icon}
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: m.positive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: m.positive ? "#22C55E" : "#EF4444",
              }}
            >
              {m.delta}
            </span>
          </div>

          {/* Value */}
          <div>
            <p
              className="text-2xl font-bold text-white tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {m.value}
            </p>
            <p className="text-xs text-white/35 mt-0.5">{m.label}</p>
          </div>

          {/* Bottom accent line */}
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full"
            style={{
              background: `linear-gradient(90deg, ${m.accent}40 0%, transparent 100%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}