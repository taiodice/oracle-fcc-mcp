import React, { useState, useMemo } from "react";
import type { DashboardState, EntityNode } from "../../hooks/useDashboard";

interface EntityTreeProps {
  dashboard: DashboardState;
}

const STATUS_CLASSES: Record<string, { dot: string; label: string; text: string }> = {
  approved:      { dot: "bg-emerald-400", label: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",   text: "text-emerald-400" },
  published:     { dot: "bg-emerald-500", label: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",   text: "text-emerald-300" },
  "under-review":{ dot: "bg-blue-400",   label: "bg-blue-500/10 text-blue-400 border-blue-500/20",            text: "text-blue-400" },
  "first-pass":  { dot: "bg-amber-400",  label: "bg-amber-500/10 text-amber-400 border-amber-500/20",         text: "text-amber-400" },
  "not-started": { dot: "bg-slate-500",  label: "bg-white/5 text-[var(--color-text-secondary)] border-white/10", text: "text-[var(--color-text-secondary)]" },
  locked:        { dot: "bg-red-400",    label: "bg-red-500/10 text-red-400 border-red-500/20",               text: "text-red-400" },
};

function statusKey(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function getStyles(status: string) {
  return STATUS_CLASSES[statusKey(status)] ?? STATUS_CLASSES["not-started"];
}

export function EntityTree({ dashboard }: EntityTreeProps) {
  const {
    entities, flatEntities, selectedEntities,
    toggleEntity, selectAllEntities, clearEntitySelection,
    error, loading,
  } = dashboard;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  const filteredFlat = useMemo(() => {
    const q = search.toLowerCase();
    return flatEntities.filter((e) => {
      const matchesSearch = !q || e.entity.toLowerCase().includes(q) || e.currentOwner.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || statusKey(e.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [flatEntities, search, statusFilter]);

  const allSelected = filteredFlat.length > 0 && filteredFlat.every((e) => selectedEntities.has(e.entity));
  const someSelected = filteredFlat.some((e) => selectedEntities.has(e.entity));

  function toggleAll() {
    if (allSelected) clearEntitySelection();
    else filteredFlat.forEach((e) => { if (!selectedEntities.has(e.entity)) toggleEntity(e.entity); });
  }

  const showFlat = !!search || statusFilter !== "all";

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-white/5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-sm">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities or owners..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-white/5 text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="under-review">Under Review</option>
          <option value="first-pass">First Pass</option>
          <option value="not-started">Not Started</option>
          <option value="locked">Locked</option>
        </select>

        <div className="w-px h-4 bg-[var(--color-border)]" />

        {/* Expand/Collapse */}
        {!showFlat && (
          <>
            <button
              onClick={() => setExpandAll(true)}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              Expand all
            </button>
            <button
              onClick={() => setExpandAll(false)}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded hover:bg-white/10 transition-colors"
            >
              Collapse all
            </button>
            <div className="w-px h-4 bg-[var(--color-border)]" />
          </>
        )}

        {/* Selection */}
        {flatEntities.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
              onChange={toggleAll}
              className="accent-[var(--color-primary)] cursor-pointer"
            />
            <span>
              {selectedEntities.size > 0
                ? `${selectedEntities.size} selected`
                : "Select all"}
            </span>
            {selectedEntities.size > 0 && (
              <button
                onClick={clearEntitySelection}
                className="text-[var(--color-text-secondary)]/50 hover:text-[var(--color-text-secondary)] transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Column headers */}
      {(entities.length > 0 || loading) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-white/3">
          <div className="w-5" />
          <div className="w-4" />
          <div className="w-2" />
          <div className="flex-1 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Entity</div>
          <div className="w-32 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</div>
          <div className="w-32 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Owner</div>
          <div className="w-8 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-center">Lvl</div>
        </div>
      )}

      {/* Content */}
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
        {error && <ErrorBanner error={error} />}

        {loading && (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ paddingLeft: `${(i % 3) * 24 + 8}px` }}>
                <div className="w-4 h-4 rounded bg-white/10 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                <div className="h-3 rounded bg-white/10 animate-pulse" style={{ width: `${100 + (i * 37) % 120}px` }} />
                <div className="ml-auto h-3 w-20 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && entities.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
            <span className="text-5xl mb-4 opacity-20">⊞</span>
            <p className="text-sm font-medium">No entity data loaded</p>
            <p className="text-xs mt-1 text-[var(--color-text-secondary)]/60">Configure the filters above and click Load Data</p>
            <button
              onClick={dashboard.loadEntityHierarchy}
              className="mt-3 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-light)] underline cursor-pointer"
            >
              Or load entity hierarchy only (without approval status)
            </button>
          </div>
        )}

        {!loading && entities.length > 0 && (
          <div>
            {showFlat ? (
              filteredFlat.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-10">No entities match your filter</p>
              ) : (
                filteredFlat.map((node) => (
                  <EntityRow
                    key={node.entity}
                    node={node}
                    depth={0}
                    selected={selectedEntities.has(node.entity)}
                    onToggle={() => toggleEntity(node.entity)}
                  />
                ))
              )
            ) : (
              entities.map((node) => (
                <TreeNode
                  key={node.entity}
                  node={node}
                  depth={0}
                  selectedEntities={selectedEntities}
                  onToggle={toggleEntity}
                  forceExpand={expandAll}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node, depth, selectedEntities, onToggle, forceExpand,
}: {
  node: EntityNode;
  depth: number;
  selectedEntities: Set<string>;
  onToggle: (entity: string) => void;
  forceExpand: boolean | null;
}) {
  const [localExpanded, setLocalExpanded] = useState(depth < 2);
  const expanded = forceExpand !== null ? forceExpand : localExpanded;
  const hasChildren = !!node.children?.length;

  return (
    <div>
      <EntityRow
        node={node}
        depth={depth}
        selected={selectedEntities.has(node.entity)}
        onToggle={() => onToggle(node.entity)}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpand={() => setLocalExpanded(!expanded)}
      />
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.entity}
              node={child}
              depth={depth + 1}
              selectedEntities={selectedEntities}
              onToggle={onToggle}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityRow({
  node, depth, selected, onToggle, hasChildren, expanded, onToggleExpand,
}: {
  node: EntityNode;
  depth: number;
  selected: boolean;
  onToggle: () => void;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const styles = getStyles(node.status);

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-4 transition-colors duration-100 group ${
        selected ? "bg-[var(--color-primary)]/10" : "hover:bg-white/5"
      }`}
      style={{ paddingLeft: `${depth * 20 + 16}px` }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="accent-[var(--color-primary)] cursor-pointer flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Expand toggle */}
      <button
        onClick={onToggleExpand}
        disabled={!hasChildren}
        className="w-4 text-xs text-[var(--color-text-secondary)]/40 hover:text-[var(--color-text-secondary)] flex-shrink-0 text-center"
      >
        {hasChildren ? (expanded ? "▾" : "▸") : ""}
      </button>

      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />

      {/* Entity name */}
      <span className="flex-1 text-sm font-data font-medium text-[var(--color-text)] truncate">
        {node.entity}
      </span>

      {/* Status badge */}
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${styles.label} w-32 text-center flex-shrink-0`}>
        {node.status}
      </span>

      {/* Owner */}
      <span className="text-xs text-[var(--color-text-secondary)] w-32 truncate text-right flex-shrink-0">
        {node.currentOwner || "—"}
      </span>

      {/* Level */}
      <span className="text-[11px] text-[var(--color-text-secondary)]/40 font-data w-8 text-center flex-shrink-0">
        L{node.promotionLevel}
      </span>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  const hintsIdx = error.indexOf("__HINTS__");
  const title = hintsIdx >= 0 ? error.slice(0, hintsIdx) : error;
  let hints: string[] = [];
  if (hintsIdx >= 0) {
    try {
      hints = JSON.parse(error.slice(hintsIdx + "__HINTS__".length));
    } catch { /* ignore parse errors */ }
  }

  return (
    <div className="m-4 rounded-lg bg-red-500/10 border border-red-500/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 text-red-400">
        <span className="text-base flex-shrink-0">✗</span>
        <span className="text-sm font-semibold">{title || "Connection Failed"}</span>
      </div>
      {hints.length > 0 && (
        <div className="px-4 pb-3 border-t border-red-500/10">
          <p className="text-[11px] font-semibold text-red-400/70 uppercase tracking-wider mt-2.5 mb-1.5">
            Troubleshooting
          </p>
          <ul className="space-y-1">
            {hints.map((hint, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-400/70">
                <span className="mt-0.5 text-red-400/40 flex-shrink-0">›</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
