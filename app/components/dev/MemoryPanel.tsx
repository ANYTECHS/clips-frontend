"use client";

import { useEffect, useState } from "react";
import { getMemoryStats, isMemoryProfilingSupported } from "@/app/lib/memoryProfiler";

/**
 * DEV_ONLY memory panel component.
 * Shows current heap usage, DOM nodes, event listeners, and worker count.
 * Only renders in development mode to avoid production overhead.
 */
export function MemoryPanel() {
  const [stats, setStats] = useState<ReturnType<typeof getMemoryStats> | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !isMemoryProfilingSupported()) {
      return;
    }

    const updateStats = () => {
      setStats(getMemoryStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    // Show panel by default in development
    setIsVisible(true);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== "development" || !isVisible || !stats) {
    return null;
  }

  const heapRatioPercent = (stats.heapUsedRatio * 100).toFixed(1);
  const heapColor = stats.heapUsedRatio > 0.9 ? "text-red-500" : stats.heapUsedRatio > 0.7 ? "text-yellow-500" : "text-green-500";

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 border border-white/20 rounded-lg p-4 text-xs font-mono z-50 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-bold">Memory Panel</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 text-white/80">
        <div className="flex justify-between">
          <span>Heap Used:</span>
          <span className={heapColor}>
            {stats.heapUsedMB}MB / {stats.heapLimitMB}MB ({heapRatioPercent}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span>Heap Total:</span>
          <span>{stats.heapTotalMB}MB</span>
        </div>
        <div className="flex justify-between">
          <span>DOM Nodes:</span>
          <span>{stats.domNodes}</span>
        </div>
        <div className="flex justify-between">
          <span>Event Listeners:</span>
          <span>{stats.eventListeners}</span>
        </div>
        <div className="flex justify-between">
          <span>Workers:</span>
          <span>{stats.workers}</span>
        </div>
      </div>

      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 bg-black/90 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white z-50"
        >
          📊 Memory
        </button>
      )}
    </div>
  );
}
