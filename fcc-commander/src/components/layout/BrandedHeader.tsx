import React from "react";
import type { View } from "../../App";

interface BrandedHeaderProps {
  currentView: View;
}

const VIEW_TITLES: Record<View, string> = {
  welcome:       "Home",
  dashboard:     "Command Center",
  "activity-log":"Activity Log",
  settings:      "Settings",
};

const VIEW_SUBTITLES: Record<View, string> = {
  welcome:       "",
  dashboard:     "Entity Status & Process Control",
  "activity-log":"Audit Trail & Operations History",
  settings:      "Configuration & API Keys",
};

export function BrandedHeader({ currentView }: BrandedHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: "var(--header-height)",
        background: "rgba(7, 17, 31, 0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-3">
        {/* Accent bar */}
        <div
          className="w-0.5 h-7 rounded-full flex-shrink-0"
          style={{ background: "linear-gradient(180deg, #1E88E5, #00BCD4)" }}
        />
        <div>
          <h1
            className="text-sm font-semibold tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "#E2EBF5" }}
          >
            {VIEW_TITLES[currentView]}
          </h1>
          {VIEW_SUBTITLES[currentView] && (
            <p className="text-[11px] -mt-0.5 font-medium" style={{ color: "#7096B8" }}>
              {VIEW_SUBTITLES[currentView]}
            </p>
          )}
        </div>
      </div>

      {/* Right: Status + Badge */}
      <div className="flex items-center gap-2.5">
        {/* Connection status */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: "rgba(0,201,167,0.08)",
            border: "1px solid rgba(0,201,167,0.2)",
            color: "#00C9A7",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </div>

      </div>
    </header>
  );
}
