import React, { useState } from "react";
import { Network, GitBranch, CalendarDays, BookOpen } from "lucide-react";
import { useDashboard } from "../../hooks/useDashboard";
import { EntityTree } from "./EntityTree";
import { ProcessControl } from "./ProcessControl";
import { PeriodStatus } from "./PeriodStatus";
import { Journals } from "./Journals";
import { StatusSummaryBar } from "./StatusSummaryBar";
import { FilterBar } from "./FilterBar";

type DashboardTab = "entities" | "process-control" | "periods" | "journals";

const TABS: Array<{
  id: DashboardTab;
  label: string;
  Icon: React.ElementType;
}> = [
  { id: "entities",        label: "Entity Hierarchy", Icon: Network },
  { id: "process-control", label: "Process Control",  Icon: GitBranch },
  { id: "periods",         label: "Period Status",    Icon: CalendarDays },
  { id: "journals",        label: "Journals",         Icon: BookOpen },
];

export function DashboardView() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("entities");
  const dashboard = useDashboard();

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <FilterBar dashboard={dashboard} />

      {/* Status Summary Bar */}
      {dashboard.flatEntities.length > 0 && (
        <StatusSummaryBar summary={dashboard.statusSummary} />
      )}

      {/* Tab Bar */}
      <div
        className="flex items-center gap-1 px-6 pt-4 pb-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const badge = id === "process-control" ? (dashboard.selectedEntities.size || undefined) : undefined;
          return (
            <TabButton
              key={id}
              active={active}
              onClick={() => setActiveTab(id)}
              label={label}
              Icon={Icon}
              badge={badge}
            />
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6 pt-5">
        {activeTab === "entities"        && <EntityTree dashboard={dashboard} />}
        {activeTab === "process-control" && <ProcessControl dashboard={dashboard} />}
        {activeTab === "periods"         && <PeriodStatus dashboard={dashboard} />}
        {activeTab === "journals"        && <Journals dashboard={dashboard} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  Icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: React.ElementType;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200"
      style={{
        color: active ? "#E2EBF5" : "#7096B8",
        background: active ? "rgba(13,27,46,0.8)" : "transparent",
        borderTop: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        borderLeft: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        borderRight: active ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        borderBottom: active ? "1px solid rgba(13,27,46,0.8)" : "1px solid transparent",
        marginBottom: active ? "-1px" : 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "#B4CCE5";
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "#7096B8";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* Active indicator line */}
      {active && (
        <div
          className="absolute top-0 left-4 right-4 h-0.5 rounded-full"
          style={{ background: "linear-gradient(90deg, #1565C0, #00BCD4)" }}
        />
      )}
      <Icon
        size={14}
        strokeWidth={active ? 2.5 : 2}
        style={{ color: active ? "#00BCD4" : undefined }}
      />
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
          style={{
            background: "linear-gradient(135deg, #1565C0, #00BCD4)",
            color: "#fff",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
