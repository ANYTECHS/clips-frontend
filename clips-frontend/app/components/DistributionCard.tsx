"use client";

/**
 * Distribution Card Component
 * Displays platform distribution breakdown
 * Spans 1/3 width in the Bento grid layout
 */

export default function DistributionCard() {
  const platforms = [
    { name: "YouTube", percentage: 45, color: "#FF0000" },
    { name: "TikTok", percentage: 30, color: "#00F2EA" },
    { name: "Instagram", percentage: 20, color: "#E4405F" },
    { name: "Other", percentage: 5, color: "#8B5CF6" },
  ];

  return (
    <div className="bento-distribution bento-card bento-card-tall">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Platform Distribution</h3>
        <p className="text-sm text-zinc-400 mt-1">Content breakdown</p>
      </div>
      
      {/* Chart Placeholder */}
      <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg mb-4">
        <div className="text-center text-zinc-500">
          <svg 
            className="w-16 h-16 mx-auto mb-2 opacity-50" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 2v10l7 7" 
            />
          </svg>
          <p className="text-sm">Distribution chart</p>
        </div>
      </div>

      {/* Platform List */}
      <div className="space-y-3">
        {platforms.map((platform) => (
          <div key={platform.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: platform.color }}
              />
              <span className="text-sm text-zinc-300">{platform.name}</span>
            </div>
            <span className="text-sm font-semibold text-white">{platform.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
