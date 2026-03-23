import React, { useState } from "react";
import type { DashboardState } from "../../hooks/useDashboard";

interface JournalsProps {
  dashboard: DashboardState;
}

interface JournalEntry {
  label: string;
  description: string;
  status: string;
  journalType: string;
  group: string;
  entity?: string;
  currency?: string;
  createdBy?: string;
  createdOn?: string;
  modifiedBy?: string;
  balanceType?: string;
  postedBy?: string | null;
}

const STATUS_FILTERS = ["WORKING", "SUBMITTED", "APPROVED", "POSTED"] as const;

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  working:   { dot: "bg-amber-400",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  submitted: { dot: "bg-blue-400",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  approved:  { dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  posted:    { dot: "bg-purple-400",  badge: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

const JOURNAL_ACTIONS = [
  { id: "submit",  label: "Submit",  from: "working",   color: "bg-blue-600 hover:bg-blue-700" },
  { id: "approve", label: "Approve", from: "submitted", color: "bg-emerald-600 hover:bg-emerald-700" },
  { id: "post",    label: "Post",    from: "approved",  color: "bg-purple-600 hover:bg-purple-700" },
  { id: "unpost",  label: "Unpost",  from: "posted",    color: "bg-slate-600 hover:bg-slate-700" },
  { id: "reject",  label: "Reject",  from: "submitted", color: "bg-red-600 hover:bg-red-700" },
] as const;

export function Journals({ dashboard }: JournalsProps) {
  const { filters } = dashboard;

  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("WORKING");
  const [totalResults, setTotalResults] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [journalDetail, setJournalDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadJournals() {
    if (!window.fccCommander || !filters.scenario || !filters.year || !filters.period) return;
    setLoading(true);
    setError(null);
    setActionResult(null);
    try {
      const result = await window.fccCommander.executeTool("fcc_manage_journal", {
        action: "list",
        scenario: filters.scenario,
        year: filters.year,
        period: filters.period,
        status: statusFilter,
        limit: 50,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      const data = result.data as { journals?: JournalEntry[]; totalResults?: number } | null;
      setJournals(data?.journals ?? []);
      setTotalResults(data?.totalResults ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadJournalDetail(label: string) {
    if (!window.fccCommander) return;
    setDetailLoading(true);
    try {
      const result = await window.fccCommander.executeTool("fcc_get_journal", {
        journal_label: label,
        scenario: filters.scenario,
        year: filters.year,
        period: filters.period,
      });
      if (result.success) {
        setJournalDetail(result.data as Record<string, unknown>);
      }
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }

  async function performAction(journalLabel: string, action: string) {
    if (!window.fccCommander) return;
    setActionLoading(`${journalLabel}-${action}`);
    setActionResult(null);
    try {
      const result = await window.fccCommander.executeTool("fcc_manage_journal", {
        action,
        journal_label: journalLabel,
        scenario: filters.scenario,
        year: filters.year,
        period: filters.period,
      });
      setActionResult({ success: result.success, message: result.message });
      if (result.success) {
        await loadJournals();
      }
    } catch (err) {
      setActionResult({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  const canLoad = filters.scenario && filters.year && filters.period;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] bg-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Journals</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-px">
              {canLoad
                ? `${filters.scenario} · ${filters.year} · ${filters.period}`
                : "Select scenario, year, and period to view journals"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] font-data cursor-pointer"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadJournals}
              disabled={loading || !canLoad}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg text-white transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--color-primary)" }}
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </>
              ) : (
                "Load Journals"
              )}
            </button>
          </div>
        </div>

        {/* Summary */}
        {journals.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Showing <span className="font-bold text-[var(--color-text)] font-data">{journals.length}</span> of{" "}
              <span className="font-bold text-[var(--color-text)] font-data">{totalResults}</span> journals
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span className="flex-shrink-0">✗</span> {error}
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
            actionResult.success
              ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <span>{actionResult.success ? "✓" : "✗"}</span>
          {actionResult.message}
          <button
            onClick={() => setActionResult(null)}
            className="ml-auto text-current opacity-40 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && journals.length === 0 && !error && (
        <div className="glass-card rounded-xl flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
          <span className="text-5xl mb-4 opacity-20">📋</span>
          <p className="text-sm font-medium">No journals loaded</p>
          <p className="text-xs mt-1 text-[var(--color-text-secondary)]/60">
            {canLoad ? "Click 'Load Journals' to fetch journals from FCC" : "Select filters above first"}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-20 h-4 rounded bg-white/10 animate-pulse" />
              <div className="flex-1 h-4 rounded bg-white/10 animate-pulse" />
              <div className="w-24 h-6 rounded-full bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Journal list */}
      {!loading && journals.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--color-border)] bg-white/5">
            <div className="w-28 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Label</div>
            <div className="flex-1 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Description</div>
            <div className="w-20 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</div>
            <div className="w-24 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Group</div>
            <div className="w-24 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">Status</div>
            <div className="w-48 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Actions</div>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {journals.map((j) => {
              const statusKey = j.status.toLowerCase();
              const styles = STATUS_STYLES[statusKey] ?? { dot: "bg-slate-500", badge: "bg-white/5 text-[var(--color-text-secondary)] border-white/10" };
              const isActing = actionLoading?.startsWith(j.label);
              const availableActions = JOURNAL_ACTIONS.filter((a) => a.from === statusKey);

              return (
                <div
                  key={j.label}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors group cursor-pointer"
                  onClick={() => {
                    setSelectedJournal(selectedJournal?.label === j.label ? null : j);
                    if (selectedJournal?.label !== j.label) loadJournalDetail(j.label);
                  }}
                >
                  {/* Label */}
                  <div className="w-28">
                    <span className="text-sm font-data font-semibold text-[var(--color-text)]">{j.label}</span>
                  </div>

                  {/* Description */}
                  <div className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">{j.description || "—"}</div>

                  {/* Type */}
                  <div className="w-20 text-xs text-[var(--color-text-secondary)] font-data">{j.journalType || "—"}</div>

                  {/* Group */}
                  <div className="w-24 text-xs text-[var(--color-text-secondary)] font-data truncate">{j.group || "—"}</div>

                  {/* Status */}
                  <div className="w-24 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${styles.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                      {j.status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="w-48 flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {isActing ? (
                      <span className="w-4 h-4 border-2 border-white/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
                    ) : (
                      availableActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => performAction(j.label, action.id)}
                          disabled={!!actionLoading}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-lg text-white transition-all duration-150 disabled:opacity-30 opacity-0 group-hover:opacity-100 ${action.color}`}
                        >
                          {action.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal detail panel */}
      {selectedJournal && (
        <div className="glass-elevated rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] bg-white/5 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--color-text)]">
              Journal: {selectedJournal.label}
            </h4>
            <button
              onClick={() => { setSelectedJournal(null); setJournalDetail(null); }}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm"
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4">
            {detailLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 rounded bg-white/10 animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                ))}
              </div>
            ) : journalDetail ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {Object.entries(journalDetail)
                  .filter(([k]) => !k.startsWith("_") && k !== "journalUrl" && k !== "links")
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-[var(--color-text-secondary)] font-data min-w-[120px]">{key}:</span>
                      <span className="text-[var(--color-text)] font-data truncate">
                        {value === null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">No details available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
