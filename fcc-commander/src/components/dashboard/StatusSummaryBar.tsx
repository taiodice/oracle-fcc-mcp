// Status summary bar — entity completion progress across the top

import React from "react";
import type { StatusSummary } from "../../hooks/useDashboard";

interface StatusSummaryBarProps {
  summary: StatusSummary;
}

const STATUS_CONFIG = [
  { key: "approved"    as const, label: "Approved",     color: "#00C9A7", glow: "rgba(0,201,167,0.5)"  },
  { key: "published"   as const, label: "Published",    color: "#00B894", glow: "rgba(0,184,148,0.4)"  },
  { key: "underReview" as const, label: "Under Review", color: "#1E88E5", glow: "rgba(30,136,229,0.4)" },
  { key: "firstPass"   as const, label: "First Pass",   color: "#F4845F", glow: "rgba(244,132,95,0.4)" },
  { key: "notStarted"  as const, label: "Not Started",  color: "#4A6A8A", glow: undefined               },
  { key: "locked"      as const, label: "Locked",       color: "#FF5252", glow: "rgba(255,82,82,0.4)"  },
];

export function StatusSummaryBar({ summary }: StatusSummaryBarProps) {
  const total = summary.total || 1;

  return (
    <div
      className="px-6 py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(5,12,24,0.4)" }}
    >
      <div className="flex items-center gap-4">
        {/* Segmented progress bar */}
        <div
          className="flex-1 h-1.5 rounded-full overflow-hidden flex"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {STATUS_CONFIG.map(({ key, color }) => {
            const count = summary[key];
            if (!count) return null;
            return (
              <div
                key={key}
                style={{ width: `${(count / total) * 100}%`, background: color }}
                className="h-full transition-all duration-500"
                title={`${count} ${key}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {STATUS_CONFIG.map(({ key, label, color, glow }) => {
            const count = summary[key];
            if (!count) return null;
            return (
              <div key={key} className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: color, boxShadow: glow ? `0 0 4px ${glow}` : undefined }}
                />
                <span className="text-[10px]" style={{ color: "#7096B8" }}>{label}</span>
                <span className="text-[10px] font-semibold font-data" style={{ color: "#B4CCE5" }}>{count}</span>
              </div>
            );
          })}
          <span className="text-[10px] font-data" style={{ color: "#4A6A8A" }}>/ {summary.total}</span>
        </div>
      </div>
    </div>
  );
}
