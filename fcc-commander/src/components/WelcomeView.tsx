import React from "react";
import {
  LayoutDashboard,
  Settings,
  Plug,
  ArrowRight,
} from "lucide-react";
import { CaptainLogo } from "./layout/CaptainLogo";
import type { View } from "../App";
import type { BrandConfig } from "../types/electron";

interface WelcomeViewProps {
  branding: BrandConfig;
  onNavigate: (view: View) => void;
}

export function WelcomeView({ branding, onNavigate }: WelcomeViewProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 relative overflow-hidden">

      {/* Ocean ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(ellipse, #19C5A3, transparent)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[300px] rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(ellipse, #19C5A3, transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-[300px] h-[200px] rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(ellipse, #F4845F, transparent)" }}
        />
      </div>

      <div className="relative max-w-2xl w-full text-center animate-fade-in">

        {/* Logo mark */}
        <div className="mb-8 flex justify-center">
          <div className="relative flex flex-col items-center gap-3">
            {/* Floating sailboat logo */}
            <CaptainLogo size={80} float animate />
            {/* FCC Commander wordmark */}
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: "2rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#F8FAFC" }}>FCC </span>
              <span style={{ color: "#19C5A3" }}>Commander</span>
            </div>
          </div>
        </div>

        {/* Heading */}
        <p className="text-sm mt-4 mb-10 leading-relaxed max-w-md mx-auto" style={{ color: "#7096B8" }}>
          {branding.welcome.subtitle}
        </p>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
          <QuickAction
            Icon={LayoutDashboard}
            title="Command Center"
            description="Entity status, process control & approvals"
            onClick={() => onNavigate("dashboard")}
            accent="#19C5A3"
            accentLight="#1E88E5"
          />
          <QuickAction
            Icon={Plug}
            title="Connect"
            description="Test your FCC environment connection"
            onClick={() => onNavigate("settings")}
            accent="#00C9A7"
            accentLight="#26D9B8"
          />
          <QuickAction
            Icon={Settings}
            title="Configure"
            description="Set up tenants, API keys & preferences"
            onClick={() => onNavigate("settings")}
            accent="#7096B8"
            accentLight="#94B0CC"
          />
        </div>

        {/* Footer */}
        <p className="mt-10 text-[11px] font-medium" style={{ color: "#7096B8", letterSpacing: "0.03em" }}>
          {branding.appName} v1.0
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  Icon,
  title,
  description,
  onClick,
  accent,
  accentLight,
  featured = false,
}: {
  Icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  accent: string;
  accentLight: string;
  featured?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-4 rounded-xl animate-slide-up transition-all duration-200"
      style={{
        background: featured
          ? `linear-gradient(135deg, rgba(0,188,212,0.1), rgba(21,101,192,0.08))`
          : "rgba(13,27,46,0.7)",
        border: featured
          ? "1px solid rgba(0,188,212,0.25)"
          : "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `${accent}40`;
        el.style.boxShadow = `0 0 0 1px ${accent}20, 0 8px 24px rgba(0,0,0,0.3)`;
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = featured ? "rgba(0,188,212,0.25)" : "rgba(255,255,255,0.06)";
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      <span
        className="inline-flex w-9 h-9 items-center justify-center rounded-lg mb-2.5"
        style={{
          background: `${accent}15`,
          border: `1px solid ${accent}25`,
          color: accent,
          transition: "transform 0.2s ease",
        }}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="font-semibold text-sm mb-0.5 flex items-center gap-1.5" style={{ color: "#E2EBF5" }}>
        {title}
        <ArrowRight
          size={12}
          strokeWidth={2.5}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: accent }}
        />
      </div>
      <div className="text-xs leading-snug" style={{ color: "#7096B8" }}>{description}</div>
    </button>
  );
}
