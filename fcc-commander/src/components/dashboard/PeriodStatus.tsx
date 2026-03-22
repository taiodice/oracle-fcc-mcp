import React, { useState, useEffect } from "react";
import type { DashboardState } from "../../hooks/useDashboard";

interface PeriodStatusProps {
  dashboard: DashboardState;
}

type PeriodStatusType = "Opened" | "Unopened";

interface PeriodInfo {
  period: string;
  status: PeriodStatusType;
}

interface BulkResult {
  period: string;
  success: boolean;
  message: string;
}

const PERIODS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_CONFIG: Record<PeriodStatusType, { dot: string; badge: string; label: string }> = {
  Opened:   { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200",  label: "Opened" },
  Unopened: { dot: "bg-slate-300",   badge: "bg-slate-50 text-slate-500 border-slate-200",        label: "Unopened" },
};

// Persist period status locally per scenario/year
function storageKey(scenario: string, year: string) {
  return `fcc_period_status_${scenario}_${year}`;
}

function loadSavedStatus(scenario: string, year: string): Record<string, PeriodStatusType> | null {
  try {
    const raw = localStorage.getItem(storageKey(scenario, year));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStatus(scenario: string, year: string, periods: PeriodInfo[]) {
  const map: Record<string, PeriodStatusType> = {};
  for (const p of periods) map[p.period] = p.status;
  localStorage.setItem(storageKey(scenario, year), JSON.stringify(map));
}

export function PeriodStatus({ dashboard }: PeriodStatusProps) {
  const { filters } = dashboard;
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selection state for bulk operations
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Load saved period statuses when filters change
  useEffect(() => {
    if (!filters.scenario || !filters.year) return;
    const saved = loadSavedStatus(filters.scenario, filters.year);
    setPeriods(
      PERIODS.map((p) => ({
        period: p,
        status: saved?.[p] ?? "Unopened",
      }))
    );
    setActionResult(null);
    setSelected(new Set());
    setBulkResults(null);
  }, [filters.scenario, filters.year]);

  function toggleSelect(period: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(PERIODS));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const allSelected = selected.size === PERIODS.length;
  const someSelected = selected.size > 0;

  function togglePeriodStatus(period: string) {
    setPeriods((prev) => {
      const updated = prev.map((p) =>
        p.period === period
          ? { ...p, status: (p.status === "Opened" ? "Unopened" : "Opened") as PeriodStatusType }
          : p
      );
      saveStatus(filters.scenario, filters.year, updated);
      return updated;
    });
  }

  function openAllUpTo(period: string) {
    const idx = PERIODS.indexOf(period);
    if (idx < 0) return;
    setPeriods((prev) => {
      const updated = prev.map((p, i) => ({
        ...p,
        status: (i <= idx ? "Opened" : "Unopened") as PeriodStatusType,
      }));
      saveStatus(filters.scenario, filters.year, updated);
      return updated;
    });
  }

  async function tryManagePeriod(period: string, action: "open" | "close") {
    if (!window.fccCommander) return;
    setActionLoading(`${period}-${action}`);
    setActionResult(null);
    try {
      const result = await window.fccCommander.executeTool("fcc_manage_journal_period", {
        action: action.toUpperCase(),
        period,
        year: filters.year,
        scenario: filters.scenario,
      });
      setActionResult({ success: result.success, message: result.message });
      if (result.success) {
        setPeriods((prev) => {
          const updated = prev.map((p) =>
            p.period === period
              ? { ...p, status: (action === "open" ? "Opened" : "Unopened") as PeriodStatusType }
              : p
          );
          saveStatus(filters.scenario, filters.year, updated);
          return updated;
        });
      }
    } catch (err) {
      setActionResult({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  async function bulkAction(action: "open" | "close") {
    if (!window.fccCommander || selected.size === 0) return;

    // Sort selected periods in calendar order
    const selectedPeriods = PERIODS.filter((p) => selected.has(p));
    setBulkRunning(true);
    setBulkResults(null);
    setActionResult(null);
    setBulkProgress({ done: 0, total: selectedPeriods.length });

    const results: BulkResult[] = [];

    // Execute sequentially to avoid overwhelming the API
    for (let i = 0; i < selectedPeriods.length; i++) {
      const period = selectedPeriods[i];
      setBulkProgress({ done: i, total: selectedPeriods.length });
      setActionLoading(`${period}-${action}`);

      try {
        const result = await window.fccCommander.executeTool("fcc_manage_journal_period", {
          action: action.toUpperCase(),
          period,
          year: filters.year,
          scenario: filters.scenario,
        });

        results.push({ period, success: result.success, message: result.message });

        if (result.success) {
          // Update local state immediately for this period
          setPeriods((prev) => {
            const updated = prev.map((p) =>
              p.period === period
                ? { ...p, status: (action === "open" ? "Opened" : "Unopened") as PeriodStatusType }
                : p
            );
            saveStatus(filters.scenario, filters.year, updated);
            return updated;
          });
        }
      } catch (err) {
        results.push({
          period,
          success: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    setActionLoading(null);
    setBulkRunning(false);
    setBulkProgress(null);
    setBulkResults(results);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed === 0) {
      setActionResult({
        success: true,
        message: `All ${succeeded} period(s) ${action === "open" ? "opened" : "closed"} successfully.`,
      });
      setSelected(new Set());
    } else {
      setActionResult({
        success: false,
        message: `${succeeded} succeeded, ${failed} failed out of ${results.length} period(s).`,
      });
    }
  }

  const statusCounts = periods.reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  if (!filters.scenario || !filters.year) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center py-20 text-slate-400">
        <span className="text-5xl mb-4 opacity-20">◷</span>
        <p className="text-sm font-medium">No period data</p>
        <p className="text-xs mt-1 text-slate-300">Select a scenario and year above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Period Status</h3>
            <p className="text-xs text-slate-400 mt-px">
              {filters.scenario} · {filters.year} — Select periods for bulk actions, or use individual controls.
            </p>
          </div>
        </div>

        {/* Summary + bulk actions strip */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-white">
          {/* Status counts */}
          <div className="flex items-center gap-4">
            {Object.entries(statusCounts).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status as PeriodStatusType] ?? STATUS_CONFIG.Unopened;
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-slate-500">{cfg.label}</span>
                  <span className="text-xs font-bold text-slate-700 font-data">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-slate-200" />

          {/* Bulk action buttons */}
          {someSelected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-data">
                {selected.size} selected
              </span>
              <button
                onClick={() => bulkAction("open")}
                disabled={bulkRunning}
                className="px-3 py-1 text-[11px] font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {bulkRunning ? "Processing..." : "Open Selected"}
              </button>
              <button
                onClick={() => bulkAction("close")}
                disabled={bulkRunning}
                className="px-3 py-1 text-[11px] font-semibold rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-50"
              >
                {bulkRunning ? "Processing..." : "Close Selected"}
              </button>
              <button
                onClick={clearSelection}
                disabled={bulkRunning}
                className="text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {bulkProgress && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden px-5 py-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-slate-600">
              Processing {bulkProgress.done + 1} of {bulkProgress.total}...
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${((bulkProgress.done + 1) / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Action result */}
      {actionResult && !bulkProgress && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
            actionResult.success
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-red-50 border-red-100 text-red-700"
          }`}
        >
          <span>{actionResult.success ? "✓" : "✗"}</span>
          {actionResult.message}
          <button
            onClick={() => { setActionResult(null); setBulkResults(null); }}
            className="ml-auto text-current opacity-40 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bulk results detail (shown only when there are failures) */}
      {bulkResults && bulkResults.some((r) => !r.success) && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/40">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Bulk Action Results</h4>
          </div>
          <div className="divide-y divide-slate-50">
            {bulkResults.map((r) => (
              <div key={r.period} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className={r.success ? "text-emerald-500" : "text-red-500"}>
                  {r.success ? "✓" : "✗"}
                </span>
                <span className="font-data font-medium text-slate-700 w-10">{r.period}</span>
                <span className={`text-xs ${r.success ? "text-emerald-600" : "text-red-600"}`}>
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs">
        <span className="flex-shrink-0 mt-0.5 font-bold">i</span>
        <div>
          <span className="font-semibold">Period status</span> is manually tracked here to match your FCC environment.
          Use the <strong>Open/Close</strong> buttons to manage <strong>journal periods</strong> via the FCCS REST API.
          For full period management (data entry, consolidation), use the FCC Cloud UI under <strong>Workflow &gt; Manage Periods</strong>.
        </div>
      </div>

      {/* Period grid */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-slate-100 bg-slate-50/20">
          <div className="w-5">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
              onChange={() => allSelected ? clearSelection() : selectAll()}
              disabled={bulkRunning}
              className="accent-amber-500 cursor-pointer"
            />
          </div>
          <div className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</div>
          <div className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Period</div>
          <div className="w-28 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Status</div>
          <div className="w-44 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-50">
          {periods.map((p, idx) => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.Unopened;
            const isActing = actionLoading?.startsWith(p.period);
            const isSelected = selected.has(p.period);

            return (
              <div
                key={p.period}
                className={`flex items-center gap-4 px-5 py-2.5 transition-colors group ${
                  isSelected ? "bg-amber-50/50" : "hover:bg-slate-50/60"
                }`}
              >
                {/* Checkbox */}
                <div className="w-5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(p.period)}
                    disabled={bulkRunning}
                    className="accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Month number */}
                <div className="w-8 text-[11px] text-slate-300 font-data">{String(idx + 1).padStart(2, "0")}</div>

                {/* Period name */}
                <div className="flex-1 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-sm font-data font-medium text-slate-700">{p.period}</span>
                </div>

                {/* Clickable status badge */}
                <div className="w-28 text-center">
                  <button
                    onClick={() => togglePeriodStatus(p.period)}
                    onContextMenu={(e) => { e.preventDefault(); openAllUpTo(p.period); }}
                    disabled={bulkRunning}
                    title={`Click to toggle local status. Right-click to open all up to ${p.period}.`}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border cursor-pointer transition-all duration-150 hover:shadow-sm disabled:opacity-50 ${cfg.badge}`}
                  >
                    {cfg.label}
                  </button>
                </div>

                {/* Action button */}
                <div className="w-44 flex items-center gap-1.5 justify-end">
                  {isActing ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : p.status === "Unopened" ? (
                    <button
                      onClick={() => tryManagePeriod(p.period, "open")}
                      disabled={!!actionLoading || bulkRunning}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-150 disabled:opacity-30 opacity-0 group-hover:opacity-100"
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      onClick={() => tryManagePeriod(p.period, "close")}
                      disabled={!!actionLoading || bulkRunning}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-all duration-150 disabled:opacity-30 opacity-0 group-hover:opacity-100"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
