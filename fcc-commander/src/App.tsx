import React, { useState, useEffect } from "react";
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
  // Incremented every time tenant config changes — forces DashboardView to remount
  // and re-fetch dimensions for the new tenant instead of using stale cached data.
  const [tenantVersion, setTenantVersion] = useState(0);

  // Re-initialize tenant manager from persisted config on startup.
  // This corrects any stale config loaded by autoRestoreTenants() before React mounted.
  useEffect(() => {
    async function syncTenants() {
      if (!window.fccCommander) return;
      try {
        let list = (await window.fccCommander.getConfig("tenantsList")) as Array<{
          id: string; url: string; appName: string; authMethod: string; username: string;
        }> | null;
        let def = (await window.fccCommander.getConfig("defaultTenant")) as string | null;

        // Migrate from legacy single-tenant format if needed
        if (!Array.isArray(list) || list.length === 0) {
          const legacy = (await window.fccCommander.getConfig("tenantConfig")) as Record<string, string> | null;
          if (legacy?.url) {
            const id = (legacy.appName || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
            list = [{ id, url: legacy.url, appName: legacy.appName || "FCCS", authMethod: legacy.authMethod || "basic", username: legacy.username || "" }];
            def = id;
            const pw = await window.fccCommander.getSecureValue("tenant.password");
            if (pw) await window.fccCommander.setSecureValue(`tenant.password.${id}`, pw);
            await window.fccCommander.setConfig("tenantsList", list);
            await window.fccCommander.setConfig("defaultTenant", def);
          }
        }

        if (Array.isArray(list) && list.length > 0) {
          const resolvedDefault = def || list[0].id;
          const tenantsMap: Record<string, unknown> = {};
          for (const t of list) {
            const pw = (await window.fccCommander.getSecureValue(`tenant.password.${t.id}`)) || "";
            tenantsMap[t.id] = { url: t.url.replace(/\/+$/, ""), app: t.appName, auth: t.authMethod, username: t.username, password: pw };
          }
          await window.fccCommander.configureTenants({ defaultTenant: resolvedDefault, tenants: tenantsMap });
          setTenantVersion((v) => v + 1);
        }
      } catch {
        // Ignore errors — fallback to whatever autoRestoreTenants set up
      }
    }
    syncTenants();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          {/* key={tenantVersion} forces a full remount when tenant config changes,
              clearing stale dimension/filter state from the previous tenant. */}
          {currentView === "dashboard" && <DashboardView key={tenantVersion} />}
          {currentView === "activity-log" && <ActivityLogView />}
          {currentView === "settings" && (
            <SettingsView onTenantChange={() => setTenantVersion((v) => v + 1)} />
          )}
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
