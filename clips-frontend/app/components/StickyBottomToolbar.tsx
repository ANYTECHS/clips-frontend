"use client";

import { useState } from "react";
import { Download, Trash2, Rocket, Send } from "lucide-react";

interface StickyBottomToolbarProps {
  selectedCount: number;
  onExport?: () => void;
  onDelete?: () => void;
  onAutoSchedule?: (enabled: boolean) => void;
  onPostSelected?: () => void;
  autoScheduleEnabled?: boolean;
}

export default function StickyBottomToolbar({
  selectedCount,
  onExport,
  onDelete,
  onAutoSchedule,
  onPostSelected,
  autoScheduleEnabled = false,
}: StickyBottomToolbarProps) {
  const [autoSchedule, setAutoSchedule] = useState(autoScheduleEnabled);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const handleAutoScheduleToggle = () => {
    const newState = !autoSchedule;
    setAutoSchedule(newState);
    onAutoSchedule?.(newState);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-4"
      style={{
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,255,157,0.15)",
      }}
    >
      <div
        className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 px-6 py-4 rounded-2xl"
        style={{
          background: "rgba(18,18,18,0.98)",
          border: "1px solid rgba(0,255,157,0.2)",
          boxShadow:
            "0 0 30px rgba(0,255,157,0.15), 0 0 60px rgba(0,255,157,0.08)",
        }}
      >
        {/* Left: Selected count pill */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "rgba(0,255,157,0.12)",
            border: "1px solid rgba(0,255,157,0.25)",
          }}
        >
          <span className="text-sm font-bold" style={{ color: "#00FF9D" }}>
            {selectedCount} {selectedCount === 1 ? "Clip" : "Clips"} selected
          </span>
        </div>

        {/* Center: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Export button */}
          <div className="relative">
            <button
              onClick={onExport}
              onMouseEnter={() => setTooltip("export")}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              aria-label="Export selected clips"
            >
              <Download size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
              <span
                className="text-xs font-semibold tracking-wide"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Export
              </span>
            </button>
            {tooltip === "export" && (
              <span
                className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
                style={{
                  background: "rgba(0,0,0,0.9)",
                  color: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Export selected clips
              </span>
            )}
          </div>

          {/* Delete button */}
          <div className="relative">
            <button
              onClick={onDelete}
              onMouseEnter={() => setTooltip("delete")}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
              aria-label="Delete selected clips"
            >
              <Trash2 size={16} style={{ color: "#EF4444" }} />
              <span
                className="text-xs font-semibold tracking-wide"
                style={{ color: "#EF4444" }}
              >
                Delete
              </span>
            </button>
            {tooltip === "delete" && (
              <span
                className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
                style={{
                  background: "rgba(0,0,0,0.9)",
                  color: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Delete selected clips
              </span>
            )}
          </div>

          {/* Auto-Schedule toggle */}
          <div className="relative">
            <button
              onClick={handleAutoScheduleToggle}
              onMouseEnter={() => setTooltip("auto-schedule")}
              onMouseLeave={() => setTooltip(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer"
              style={{
                background: autoSchedule
                  ? "rgba(0,255,157,0.12)"
                  : "rgba(255,255,255,0.06)",
                border: `1px solid ${autoSchedule ? "rgba(0,255,157,0.25)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: autoSchedule
                  ? "0 0 15px rgba(0,255,157,0.1)"
                  : "none",
              }}
              aria-pressed={autoSchedule}
              aria-label="Toggle auto-schedule"
            >
              <Rocket
                size={16}
                className="transition-colors duration-200"
                style={{
                  color: autoSchedule ? "#00FF9D" : "rgba(255,255,255,0.5)",
                }}
              />
              <span
                className="text-xs font-semibold tracking-wide transition-colors duration-200"
                style={{
                  color: autoSchedule ? "#00FF9D" : "rgba(255,255,255,0.5)",
                }}
              >
                Auto-Schedule
              </span>
              {/* Toggle indicator */}
              <div
                className="relative w-8 h-4 rounded-full transition-colors duration-200 ml-1"
                style={{
                  background: autoSchedule
                    ? "rgba(0,255,157,0.35)"
                    : "rgba(255,255,255,0.12)",
                }}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200"
                  style={{
                    left: autoSchedule ? "16px" : "2px",
                    background: autoSchedule
                      ? "#00FF9D"
                      : "rgba(255,255,255,0.5)",
                    boxShadow: autoSchedule
                      ? "0 0 6px rgba(0,255,157,0.5)"
                      : "none",
                  }}
                />
              </div>
            </button>
            {tooltip === "auto-schedule" && (
              <span
                className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
                style={{
                  background: "rgba(0,0,0,0.9)",
                  color: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {autoSchedule ? "Disable" : "Enable"} auto-scheduling
              </span>
            )}
          </div>
        </div>

        {/* Right: Primary Post button */}
        <button
          onClick={onPostSelected}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #00FF9D 0%, #00E68D 100%)",
            color: "#000",
            boxShadow:
              "0 0 20px rgba(0,255,157,0.4), 0 0 40px rgba(0,255,157,0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 30px rgba(0,255,157,0.6), 0 0 60px rgba(0,255,157,0.3)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 20px rgba(0,255,157,0.4), 0 0 40px rgba(0,255,157,0.2)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          aria-label="Post selected clips"
        >
          <Send size={18} />
          <span>Post Selected Clips</span>
        </button>
      </div>
    </div>
  );
}
