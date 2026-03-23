import React from "react";
import {
  Home,
  LayoutDashboard,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CaptainLogo, CaptainWordmark } from "./CaptainLogo";
import type { View } from "../../App";
import type { BrandConfig } from "../../types/electron";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  branding: BrandConfig;
}

const NAV_ITEMS: Array<{ id: View; label: string; Icon: React.ElementType }> = [
  { id: "welcome",      label: "Home",           Icon: Home },
  { id: "dashboard",   label: "Command Center",  Icon: LayoutDashboard },
  { id: "activity-log",label: "Activity Log",    Icon: ScrollText },
  { id: "settings",    label: "Settings",        Icon: Settings },
];

export function Sidebar({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  branding,
}: SidebarProps) {
  return (
    <aside
      className="h-full flex flex-col dark-scroll overflow-hidden transition-all duration-300 ease-out relative"
      style={{
        width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        background: branding.colors.sidebar,
        color: branding.colors.sidebarText,
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Subtle ocean glow top */}
      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top center, rgba(21,101,192,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Brand Header */}
      <div className="relative px-3 py-4 flex items-center justify-center" style={{ borderBottom: "1px solid rgba(25,197,163,0.08)" }}>
        {collapsed ? (
          <CaptainLogo size={32} animate />
        ) : (
          <div className="animate-fade-in">
            <CaptainWordmark logoSize={36} fontSize="1.1rem" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = currentView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group"
              style={{
                background: active ? "rgba(25,197,163,0.12)" : "transparent",
                color: active ? "#E2EBF5" : branding.colors.sidebarText,
                boxShadow: active ? "inset 0 0 0 1px rgba(25,197,163,0.2)" : "none",
              }}
              title={collapsed ? label : undefined}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "#E2EBF5";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = branding.colors.sidebarText;
                }
              }}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.5 : 1.8}
                className="flex-shrink-0"
                style={{ color: active ? "#19C5A3" : undefined }}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
              {active && !collapsed && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#19C5A3", boxShadow: "0 0 6px rgba(0,188,212,0.6)" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
          style={{ color: "#7096B8" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = "#B4CCE5";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = "#7096B8";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {collapsed
            ? <ChevronRight size={14} strokeWidth={2} />
            : <><ChevronLeft size={14} strokeWidth={2} /><span className="text-xs">Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
