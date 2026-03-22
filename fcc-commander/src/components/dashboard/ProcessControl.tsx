import React, { useState } from "react";
import type { DashboardState } from "../../hooks/useDashboard";

interface ProcessControlProps {
  dashboard: DashboardState;
}

interface BulkResult {
  entity: string;
  period: string;
  success: boolean;
  message: string;
  jobId?: number;
}

interface ProgressState {
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  current: string;
}

const PERIODS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ACTIONS = [
  { id: "promote",  label: "Promote",   color: "bg-blue-600 hover:bg-blue-700",   icon: "↑" },
  { id: "reject",   label: "Reject",    color: "bg-red-600 hover:bg-red-700",     icon: "↓" },
  { id: "approve",  label: "Approve",   color: "bg-emerald-600 hover:bg-emerald-700", icon: "✓" },
  { id: "sign_off", label: "Sign Off",  color: "bg-purple-600 hover:bg-purple-700",   icon: "★" },
] as const;

export function ProcessControl({ dashboard }: ProcessControlProps) {
  const { flatEntities, selectedEntities, toggleEntity, filters } = dashboard;

  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const togglePeriod = (p: string) => {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const selectQ = (quarter: number) => {
    const qPeriods = [
      ["Jan","Feb","Mar"], ["Apr","May","Jun"],
      ["Jul","Aug","Sep"], ["Oct","Nov","Dec"],
    ][quarter];
    setSelectedPeriods(new Set(qPeriods));
  };

  const hasSelection = selectedEntities.size > 0 && selectedPeriods.size > 0;
  const operationCount = selectedEntities.size * selectedPeriods.size;

  async function runBulkAction(action: string) {
    if (!hasSelection || !window.fccCommander) return;
    setConfirmAction(null);
    setRunning(true);
    setResults([]);
    setShowResults(false);

    const entities = Array.from(selectedEntities);
    const periods = Array.from(selectedPeriods);
    const total = entities.length * periods.length;

    setProgress({ total, done: 0, succeeded: 0, failed: 0, current: "" });

    // Execute all entity×period combinations, showing real-time progress
    const allResults: BulkResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const entity of entities) {
      for (const period of periods) {
        setProgress((p) => p ? { ...p, current: `${entity} · ${period}` } : p);
        try {
          const result = await window.fccCommander.executeTool("fcc_manage_approval", {
            action,
            entities: [entity],
            scenario: filters.scenario,
            year: filters.year,
            periods: [period],
            comment: comment || undefined,
          });

          const opResults = Array.isArray(result.data)
            ? (result.data as BulkResult[])
            : [{ entity, period, success: result.success, message: result.message }];

          allResults.push(...opResults);
          if (result.success) succeeded += opResults.length;
          else failed += opResults.length;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          allResults.push({ entity, period, success: false, message });
          failed++;
        }

        setProgress((p) =>
          p ? { ...p, done: p.done + 1, succeeded: succeeded, failed: failed } : p
        );
      }
    }

    setResults(allResults);
    setProgress(null);
    setRunning(false);
    setShowResults(true);
  }

  return (
    <div className="space-y-4">
      {/* ── No entities loaded warning ── */}
      {flatEntities.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          Load entity data from the <strong>Entity Hierarchy</strong> tab first, then select entities there to use here.
        </div>
      )}

      {/* ── Action Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Bulk Approval Actions</h3>
            <p className="text-xs text-slate-400 mt-px">
              Select entities in the hierarchy, choose periods, then act on all at once
            </p>
          </div>
          {hasSelection && (
            <div className="text-xs text-slate-500 font-data bg-white border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="font-bold text-slate-700">{selectedEntities.size}</span> entities ×{" "}
              <span className="font-bold text-slate-700">{selectedPeriods.size}</span> periods ={" "}
              <span className="font-bold text-amber-600">{operationCount}</span> ops
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Period selector */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Periods
              </label>
              <div className="flex gap-1 ml-auto">
                {["Q1","Q2","Q3","Q4"].map((q, i) => (
                  <button
                    key={q}
                    onClick={() => selectQ(i)}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600 transition-colors font-medium"
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedPeriods(new Set(PERIODS))}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600 transition-colors font-medium"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedPeriods(new Set())}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePeriod(p)}
                  className={`px-3 py-1.5 text-xs font-data font-medium rounded-lg border transition-all duration-150 ${
                    selectedPeriods.has(p)
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Comment (optional)
            </label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment for the approval workflow..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => setConfirmAction(action.id)}
                disabled={!hasSelection || running}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${action.color}`}
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Confirmation Dialog ── */}
      {confirmAction && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-lg mt-0.5">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Confirm: {ACTIONS.find((a) => a.id === confirmAction)?.label}
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                This will <strong>{confirmAction.replace("_", " ")}</strong>{" "}
                <strong className="text-slate-700">{selectedEntities.size} entities</strong> across{" "}
                <strong className="text-slate-700">{selectedPeriods.size} periods</strong>{" "}
                ({operationCount} operations). This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => runBulkAction(confirmAction)}
                  className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {running && progress && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-800">Processing...</span>
            <span className="text-sm font-data text-slate-500">
              {progress.done} / {progress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-data truncate max-w-[60%]">
              {progress.current}
            </span>
            <div className="flex items-center gap-3 text-xs font-data">
              <span className="text-emerald-600">✓ {progress.succeeded}</span>
              {progress.failed > 0 && <span className="text-red-500">✕ {progress.failed}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {showResults && results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/40">
            <h3 className="text-sm font-semibold text-slate-800">Results</h3>
            <div className="flex items-center gap-3 text-xs font-data">
              <span className="text-emerald-600 font-semibold">
                ✓ {results.filter((r) => r.success).length} succeeded
              </span>
              {results.some((r) => !r.success) && (
                <span className="text-red-500 font-semibold">
                  ✕ {results.filter((r) => !r.success).length} failed
                </span>
              )}
              <button
                onClick={() => setShowResults(false)}
                className="text-slate-300 hover:text-slate-500"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto dark-scroll divide-y divide-slate-50">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-5 py-2 text-xs ${
                  r.success ? "text-slate-600" : "bg-red-50/50 text-slate-600"
                }`}
              >
                <span className={r.success ? "text-emerald-500" : "text-red-400"}>
                  {r.success ? "✓" : "✕"}
                </span>
                <span className="font-data font-medium w-40 truncate">{r.entity}</span>
                <span className="text-slate-300">·</span>
                <span className="font-data w-8">{r.period}</span>
                <span className="text-slate-400 flex-1 truncate">{r.message}</span>
                {r.jobId && (
                  <span className="text-slate-300 font-data">#{r.jobId}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Entity selection list ── */}
      {flatEntities.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Selected Entities ({selectedEntities.size} of {flatEntities.length})
            </h3>
            <p className="text-xs text-slate-400">
              Use checkboxes in the Entity Hierarchy tab to add/remove
            </p>
          </div>
          <div className="max-h-48 overflow-auto dark-scroll divide-y divide-slate-50">
            {flatEntities.filter((e) => selectedEntities.has(e.entity)).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No entities selected — use the Entity Hierarchy tab to select them
              </p>
            ) : (
              flatEntities
                .filter((e) => selectedEntities.has(e.entity))
                .map((e) => (
                  <div key={e.entity} className="flex items-center gap-3 px-5 py-2 text-xs text-slate-600">
                    <span className="font-data font-medium flex-1">{e.entity}</span>
                    <span className="text-slate-300">{e.status}</span>
                    <button
                      onClick={() => dashboard.toggleEntity(e.entity)}
                      className="text-slate-300 hover:text-slate-500 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
