"use client";

import { useState, useEffect } from "react";

/**
 * Grid Debugger Component
 * Shows current viewport size and active breakpoint
 * Useful for testing responsive behavior
 * 
 * Usage: Add <GridDebugger /> to any page during development
 */

export default function GridDebugger() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const getBreakpoint = (width: number) => {
    if (width < 640) return { name: "Mobile", color: "#EF4444", cols: 1 };
    if (width < 1024) return { name: "Tablet", color: "#F59E0B", cols: 6 };
    if (width < 1440) return { name: "Desktop", color: "#10B981", cols: 12 };
    if (width < 1920) return { name: "Large", color: "#3B82F6", cols: 12 };
    return { name: "XL", color: "#8B5CF6", cols: 12 };
  };

  const breakpoint = getBreakpoint(dimensions.width);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-zinc-800 text-white flex items-center justify-center shadow-lg hover:bg-zinc-700 transition-colors z-50"
        title="Show Grid Debugger"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-4 z-50 min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Grid Debugger</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-zinc-400 hover:text-white transition-colors"
          title="Hide"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Viewport:</span>
          <span className="text-white font-mono">
            {dimensions.width} × {dimensions.height}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Breakpoint:</span>
          <span
            className="px-2 py-0.5 rounded font-semibold text-xs"
            style={{ backgroundColor: `${breakpoint.color}20`, color: breakpoint.color }}
          >
            {breakpoint.name}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Grid Columns:</span>
          <span className="text-white font-mono">{breakpoint.cols}</span>
        </div>

        <div className="pt-2 mt-2 border-t border-zinc-700">
          <div className="text-xs text-zinc-500 space-y-1">
            <div>Mobile: &lt; 640px</div>
            <div>Tablet: 640px - 1023px</div>
            <div>Desktop: 1024px - 1439px</div>
            <div>Large: 1440px - 1919px</div>
            <div>XL: ≥ 1920px</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-700">
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-2 rounded"
              style={{
                backgroundColor: i < breakpoint.cols ? breakpoint.color : "#27272a",
                opacity: i < breakpoint.cols ? 1 : 0.3,
              }}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2 text-center">Active columns</p>
      </div>
    </div>
  );
}
