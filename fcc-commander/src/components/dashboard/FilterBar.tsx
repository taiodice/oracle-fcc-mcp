// Shared filter bar — scenario / year / period selector used across all tabs

import React from "react";
import { Play } from "lucide-react";
import type { DashboardState } from "../../hooks/useDashboard";

interface FilterBarProps {
  dashboard: DashboardState;
}

const PERIODS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const SELECT_STYLE: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "13px",
  background: "rgba(13,27,46,0.8)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#E2EBF5",
  cursor: "pointer",
  outline: "none",
  fontFamily: "var(--font-mono)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "#7096B8",
};

export function FilterBar({ dashboard }: FilterBarProps) {
  const { filters, setFilters, loading, setLoading, setEntities, setError, dimensionOptions } = dashboard;
  const { scenarios, years, loadingDimensions } = dimensionOptions;

  async function loadData() {
    if (!window.fccCommander) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.fccCommander.executeTool("fcc_get_approval_status", {
        scenario: filters.scenario,
        year: filters.year,
        period: filters.period,
        include_descendants: true,
      });

      if (!result.success) {
        const msg = result.message || "";
        const warnings = (result as { warnings?: string[] }).warnings || [];
        if (msg.toLowerCase().includes("unknown tool")) {
          warnings.push("No FCC tenant is configured. Go to Settings > FCC Tenants and click Save & Connect first.");
        }
        const errorParts = [msg];
        if (warnings.length) errorParts.push("__HINTS__" + JSON.stringify(warnings));
        setError(errorParts.join(""));
        return;
      }

      const data = result.data as { tree?: unknown[] } | null;
      setEntities((data?.tree ?? []) as Parameters<typeof setEntities>[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center gap-4 px-6 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,17,31,0.5)" }}
    >
      {/* Scenario */}
      <div className="flex items-center gap-2">
        <label style={LABEL_STYLE}>Scenario</label>
        {scenarios.length > 0 ? (
          <select
            value={filters.scenario}
            onChange={(e) => setFilters({ ...filters, scenario: e.target.value })}
            style={{ ...SELECT_STYLE, width: 140 }}
          >
            {!filters.scenario && <option value="">Select...</option>}
            {scenarios.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input
            value={filters.scenario}
            onChange={(e) => setFilters({ ...filters, scenario: e.target.value })}
            placeholder={loadingDimensions ? "Loading..." : "e.g. Actual"}
            style={{ ...SELECT_STYLE, width: 140 }}
          />
        )}
      </div>

      {/* Year */}
      <div className="flex items-center gap-2">
        <label style={LABEL_STYLE}>Year</label>
        {years.length > 0 ? (
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            style={{ ...SELECT_STYLE, width: 110 }}
          >
            {!filters.year && <option value="">Select...</option>}
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : (
          <input
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            placeholder={loadingDimensions ? "Loading..." : "e.g. FY25"}
            style={{ ...SELECT_STYLE, width: 110 }}
          />
        )}
      </div>

      {/* Period */}
      <div className="flex items-center gap-2">
        <label style={LABEL_STYLE}>Period</label>
        <select
          value={filters.period}
          onChange={(e) => setFilters({ ...filters, period: e.target.value })}
          style={{ ...SELECT_STYLE, width: 90 }}
        >
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)" }} />

      {/* Load button */}
      <button
        onClick={loadData}
        disabled={loading || !filters.scenario || !filters.year}
        className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #1565C0, #1E88E5)",
          color: "#fff",
          boxShadow: "0 4px 12px rgba(21,101,192,0.3)",
        }}
      >
        {loading ? (
          <>
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Play size={12} strokeWidth={2.5} />
            Load Data
          </>
        )}
      </button>

      {/* Context label */}
      {dashboard.flatEntities.length > 0 && (
        <span className="ml-auto text-xs font-data" style={{ color: "#7096B8" }}>
          {filters.scenario} · {filters.year} · {filters.period} ·{" "}
          <span className="font-semibold" style={{ color: "#B4CCE5" }}>{dashboard.flatEntities.length} entities</span>
        </span>
      )}
    </div>
  );
}
