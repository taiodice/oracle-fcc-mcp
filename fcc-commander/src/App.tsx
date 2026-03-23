import React, { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { BrandedHeader } from "./components/layout/BrandedHeader";
import { DashboardView } from "./components/dashboard/DashboardView";
import { SettingsView } from "./components/settings/SettingsView";
import { WelcomeView } from "./components/WelcomeView";
import { ActivityLogView } from "./components/ActivityLogView";
import { UpdateBanner } from "./components/UpdateBanner";
import { ChatPanel } from "./components/chat/ChatPanel";
import { useBranding } from "./hooks/useBranding";

export type View = "welcome" | "dashboard" | "settings" | "activity-log";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("welcome");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { branding, loading } = useBranding();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center ocean-gradient">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00BCD4', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium tracking-widest uppercase" style={{ color: '#7096B8' }}>
            Initializing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden ocean-gradient grid-pattern">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        branding={branding}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <BrandedHeader
          currentView={currentView}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />

        <main className="flex-1 overflow-auto">
          {currentView === "welcome" && (
            <WelcomeView branding={branding} onNavigate={setCurrentView} />
          )}
          {currentView === "dashboard" && <DashboardView />}
          {currentView === "activity-log" && <ActivityLogView />}
          {currentView === "settings" && <SettingsView />}
        </main>
      </div>

      {/* AI Chat Panel */}
      {chatOpen && (
        <ChatPanel
          onClose={() => setChatOpen(false)}
          onNavigateToSettings={() => { setCurrentView("settings"); setChatOpen(false); }}
        />
      )}

      {/* Auto-update notification */}
      <UpdateBanner />
    </div>
  );
}
