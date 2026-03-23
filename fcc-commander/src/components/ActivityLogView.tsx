import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Trash2, ScrollText } from "lucide-react";
import type { AuditEntry, AuditCategory, AuditQuery, AuditStats } from "../types/electron";

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  approval:             "Approval",
  period:               "Period",
  data:                 "Data",
  substitution_variable:"Sub Variables",
  consolidation:        "Consolidation",
  journal:              "Journal",
  ownership:            "Ownership",
  intercompany:         "Intercompany",
  metadata:             "Metadata",
  connection:           "Connection",
  job:                  "Job",
  other:                "Other",
};

// Dark-theme badge styles per category
const CATEGORY_STYLES: Record<AuditCategory, React.CSSProperties> = {
  approval:             { background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.2)" },
  period:               { background: "rgba(30,136,229,0.15)", color: "#60A5FA", border: "1px solid rgba(30,136,229,0.2)" },
  data:                 { background: "rgba(0,201,167,0.12)", color: "#34D399", border: "1px solid rgba(0,201,167,0.2)" },
  substitution_variable:{ background: "rgba(244,132,95,0.12)", color: "#FCA46A", border: "1px solid rgba(244,132,95,0.2)" },
  consolidation:        { background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.2)" },
  journal:              { background: "rgba(244,114,182,0.12)", color: "#F472B6", border: "1px solid rgba(244,114,182,0.2)" },
  ownership:            { background: "rgba(0,188,212,0.12)", color: "#22D3EE", border: "1px solid rgba(0,188,212,0.2)" },
  intercompany:         { background: "rgba(251,146,60,0.12)", color: "#FB923C", border: "1px solid rgba(251,146,60,0.2)" },
  metadata:             { background: "rgba(112,150,184,0.1)", color: "#94B0CC",  border: "1px solid rgba(112,150,184,0.15)" },
  connection:           { background: "rgba(0,188,212,0.12)", color: "#67E8F9", border: "1px solid rgba(0,188,212,0.2)" },
  job:                  { background: "rgba(163,230,53,0.1)", color: "#A3E635", border: "1px solid rgba(163,230,53,0.2)" },
  other:                { background: "rgba(112,150,184,0.1)", color: "#94B0CC",  border: "1px solid rgba(112,150,184,0.15)" },
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(13,27,46,0.8)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#E2EBF5",
  borderRadius: "8px",
  padding: "6px 12px",
  fontSize: "13px",
  outline: "none",
};

export function ActivityLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [category, setCategory] = useState<AuditCategory | "">("");
  const [successFilter, setSuccessFilter] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const buildQuery = useCallback((): AuditQuery => {
    const q: AuditQuery = { limit: pageSize, offset: page * pageSize };
    if (category) q.category = category;
    if (successFilter === "true") q.success = true;
    if (successFilter === "false") q.success = false;
    if (search.trim()) q.search = search.trim();
    return q;
  }, [category, successFilter, search, page]);

  const loadData = useCallback(async () => {
    if (!window.fccCommander) return;
    setLoading(true);
    try {
      const [result, s] = await Promise.all([
        window.fccCommander.queryAudit(buildQuery()),
        window.fccCommander.getAuditStats(),
      ]);
      setEntries(result.entries);
      setTotal(result.total);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(0); }, [category, successFilter, search]);

  async function handleExport() {
    if (!window.fccCommander) return;
    setExporting(true);
    try {
      const q = buildQuery();
      delete q.limit;
      delete q.offset;
      await window.fccCommander.exportAudit(q);
    } finally {
      setExporting(false);
    }
  }

  async function handleClear() {
    if (!window.fccCommander) return;
    if (!confirm("Clear all audit entries? This cannot be undone.")) return;
    await window.fccCommander.clearAudit();
    loadData();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="h-full flex flex-col" style={{ background: "transparent" }}>
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,17,31,0.6)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "#E2EBF5" }}>
              Activity Log
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#7096B8" }}>
              Audit trail of all FCC operations
              {stats && ` — ${stats.totalEntries.toLocaleString()} total entries`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", color: "#B4CCE5", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <RefreshCw size={12} strokeWidth={2} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)", color: "#fff", boxShadow: "0 4px 12px rgba(21,101,192,0.3)" }}
            >
              <Download size={12} strokeWidth={2} />
              {exporting ? "Exporting..." : "Export"}
            </button>
            <button
              onClick={handleClear}
              disabled={total === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "rgba(255,82,82,0.1)", color: "#FF5252", border: "1px solid rgba(255,82,82,0.2)" }}
            >
              <Trash2 size={12} strokeWidth={2} />
              Clear
            </button>
          </div>
        </div>

        {/* Stats pills */}
        {stats && stats.totalEntries > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <StatPill label="Success" value={stats.successCount} success />
            <StatPill label="Failed" value={stats.failureCount} error />
            {Object.entries(stats.byCategory)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([cat, count]) => (
                <StatPill key={cat} label={CATEGORY_LABELS[cat as AuditCategory] || cat} value={count} />
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search operations..."
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AuditCategory | "")}
            style={INPUT_STYLE}
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={successFilter}
            onChange={(e) => setSuccessFilter(e.target.value as "" | "true" | "false")}
            style={INPUT_STYLE}
          >
            <option value="">All Status</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "#7096B8" }}>Loading audit trail...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4 opacity-20">
              <ScrollText size={48} style={{ color: "#7096B8" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "#7096B8" }}>No audit entries found.</p>
            <p className="text-xs mt-1" style={{ color: "#4A6A8A" }}>
              Activities will appear here as you use FCC tools.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "rgba(7,17,31,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <tr className="text-left" style={{ color: "#7096B8" }}>
                <th className="px-4 py-2.5 w-44 text-[10px] font-semibold uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-2.5 w-28 text-[10px] font-semibold uppercase tracking-wider">Category</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">Operation</th>
                <th className="px-4 py-2.5 w-16 text-[10px] font-semibold uppercase tracking-wider">Source</th>
                <th className="px-4 py-2.5 w-16 text-center text-[10px] font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 w-20 text-right text-[10px] font-semibold uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <td className="px-4 py-2.5 font-data text-xs whitespace-nowrap" style={{ color: "#7096B8" }}>
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={CATEGORY_STYLES[entry.category]}
                      >
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium" style={{ color: "#E2EBF5" }}>
                        {formatToolName(entry.toolName)}
                      </div>
                      <div className="text-[11px] truncate max-w-md mt-0.5" style={{ color: "#7096B8" }}>
                        {entry.resultSummary}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={entry.source === "chat"
                          ? { background: "rgba(139,92,246,0.15)", color: "#A78BFA" }
                          : { background: "rgba(30,136,229,0.15)", color: "#60A5FA" }}
                      >
                        {entry.source === "chat" ? "AI Chat" : "Direct"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{
                          background: entry.success ? "#00C9A7" : "#FF5252",
                          boxShadow: entry.success ? "0 0 6px rgba(0,201,167,0.5)" : "0 0 6px rgba(255,82,82,0.4)",
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-data text-xs" style={{ color: "#7096B8" }}>
                      {entry.durationMs}ms
                    </td>
                  </tr>

                  {expandedId === entry.id && (
                    <tr style={{ background: "rgba(13,27,46,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {[["Arguments", JSON.stringify(entry.args, null, 2)], ["Result", entry.resultSummary]].map(([title, content]) => (
                            <div key={title}>
                              <h4 className="font-semibold mb-2 uppercase tracking-wider text-[10px]" style={{ color: "#7096B8" }}>
                                {title}
                              </h4>
                              <pre
                                className="rounded-lg p-3 font-data overflow-x-auto max-h-40 whitespace-pre-wrap text-[11px]"
                                style={{ background: "rgba(5,12,24,0.6)", border: "1px solid rgba(255,255,255,0.06)", color: "#B4CCE5" }}
                              >
                                {content}
                              </pre>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-4 text-[11px]" style={{ color: "#4A6A8A" }}>
                          <span>ID: <span className="font-data">{entry.id.slice(0, 8)}</span></span>
                          <span>Tool: <span className="font-data">{entry.toolName}</span></span>
                          {entry.tenant && <span>Tenant: <span className="font-data">{entry.tenant}</span></span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="px-4 py-3 flex items-center justify-between text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,17,31,0.6)", color: "#7096B8" }}
        >
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            {["Prev", "Next"].map((label, i) => (
              <button
                key={label}
                onClick={() => setPage(p => i === 0 ? Math.max(0, p - 1) : Math.min(totalPages - 1, p + 1))}
                disabled={i === 0 ? page === 0 : page >= totalPages - 1}
                className="px-2.5 py-1 rounded transition-colors disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.05)", color: "#B4CCE5" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, success, error }: { label: string; value: number; success?: boolean; error?: boolean }) {
  const style: React.CSSProperties = success
    ? { background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }
    : error
    ? { background: "rgba(255,82,82,0.1)", color: "#FF5252", border: "1px solid rgba(255,82,82,0.2)" }
    : { background: "rgba(112,150,184,0.08)", color: "#7096B8", border: "1px solid rgba(112,150,184,0.15)" };

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={style}>
      {label}
      <span className="font-bold">{value}</span>
    </span>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatToolName(name: string): string {
  return name
    .replace(/^fcc_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
