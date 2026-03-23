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
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 text-sm text-amber-400">
          Load entity data from the <strong>Entity Hierarchy</strong> tab first, then select entities there to use here.
        </div>
      )}

      {/* ── Action Panel ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Bulk Approval Actions</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-px">
              Select entities in the hierarchy, choose periods, then act on all at once
            </p>
          </div>
          {hasSelection && (
            <div className="text-xs text-[var(--color-text-secondary)] font-data bg-white/5 border border-[var(--color-border)] rounded-lg px-3 py-1.5">
              <span className="font-bold text-[var(--color-text)]">{selectedEntities.size}</span> entities ×{" "}
              <span className="font-bold text-[var(--color-text)]">{selectedPeriods.size}</span> periods ={" "}
              <span className="font-bold text-[var(--color-primary)]">{operationCount}</span> ops
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Period selector */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Periods
              </label>
              <div className="flex gap-1 ml-auto">
                {["Q1","Q2","Q3","Q4"].map((q, i) => (
                  <button
                    key={q}
                    onClick={() => selectQ(i)}
                    className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-colors font-medium"
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedPeriods(new Set(PERIODS))}
                  className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-colors font-medium"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedPeriods(new Set())}
                  className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
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
                      ? "bg-[var(--color-primary)] text-[var(--color-background)] border-[var(--color-primary)] shadow-sm"
                      : "bg-white/5 text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider block mb-1.5">
              Comment (optional)
            </label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment for the approval workflow..."
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white/5 text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
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
        <div className="glass-elevated rounded-xl p-5 animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-lg mt-0.5">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-1">
                Confirm: {ACTIONS.find((a) => a.id === confirmAction)?.label}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                This will <strong className="text-[var(--color-text)]">{confirmAction.replace("_", " ")}</strong>{" "}
                <strong className="text-[var(--color-text)]">{selectedEntities.size} entities</strong> across{" "}
                <strong className="text-[var(--color-text)]">{selectedPeriods.size} periods</strong>{" "}
                ({operationCount} operations). This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => runBulkAction(confirmAction)}
                  className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white transition-colors"
                  style={{ background: "var(--color-primary)" }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-white/10 hover:bg-white/15 transition-colors"
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
        <div className="glass-card rounded-xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[var(--color-text)]">Processing...</span>
            <span className="text-sm font-data text-[var(--color-text-secondary)]">
              {progress.done} / {progress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%`, background: "var(--color-primary)" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)] font-data truncate max-w-[60%]">
              {progress.current}
            </span>
            <div className="flex items-center gap-3 text-xs font-data">
              <span className="text-emerald-400">✓ {progress.succeeded}</span>
              {progress.failed > 0 && <span className="text-red-400">✕ {progress.failed}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {showResults && results.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-white/5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Results</h3>
            <div className="flex items-center gap-3 text-xs font-data">
              <span className="text-emerald-400 font-semibold">
                ✓ {results.filter((r) => r.success).length} succeeded
              </span>
              {results.some((r) => !r.success) && (
                <span className="text-red-400 font-semibold">
                  ✕ {results.filter((r) => !r.success).length} failed
                </span>
              )}
              <button
                onClick={() => setShowResults(false)}
                className="text-[var(--color-text-secondary)]/40 hover:text-[var(--color-text-secondary)]"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto dark-scroll divide-y divide-[var(--color-border)]">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-5 py-2 text-xs ${
                  r.success ? "text-[var(--color-text-secondary)]" : "bg-red-500/5 text-[var(--color-text-secondary)]"
                }`}
              >
                <span className={r.success ? "text-emerald-400" : "text-red-400"}>
                  {r.success ? "✓" : "✕"}
                </span>
                <span className="font-data font-medium w-40 truncate text-[var(--color-text)]">{r.entity}</span>
                <span className="text-[var(--color-text-secondary)]/30">·</span>
                <span className="font-data w-8">{r.period}</span>
                <span className="text-[var(--color-text-secondary)] flex-1 truncate">{r.message}</span>
                {r.jobId && (
                  <span className="text-[var(--color-text-secondary)]/30 font-data">#{r.jobId}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Entity selection list ── */}
      {flatEntities.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] bg-white/5 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Selected Entities ({selectedEntities.size} of {flatEntities.length})
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]/60">
              Use checkboxes in the Entity Hierarchy tab to add/remove
            </p>
          </div>
          <div className="max-h-48 overflow-auto dark-scroll divide-y divide-[var(--color-border)]">
            {flatEntities.filter((e) => selectedEntities.has(e.entity)).length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                No entities selected — use the Entity Hierarchy tab to select them
              </p>
            ) : (
              flatEntities
                .filter((e) => selectedEntities.has(e.entity))
                .map((e) => (
                  <div key={e.entity} className="flex items-center gap-3 px-5 py-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="font-data font-medium flex-1 text-[var(--color-text)]">{e.entity}</span>
                    <span className="text-[var(--color-text-secondary)]/40">{e.status}</span>
                    <button
                      onClick={() => dashboard.toggleEntity(e.entity)}
                      className="text-[var(--color-text-secondary)]/40 hover:text-[var(--color-text-secondary)] transition-colors"
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
