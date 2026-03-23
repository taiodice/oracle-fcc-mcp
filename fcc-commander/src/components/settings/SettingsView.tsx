import React, { useState, useEffect } from "react";
import { LLM_PROVIDERS } from "../../constants/providers";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  configured: boolean;
}

const PROVIDERS: Array<{ id: string; name: string; description: string }> = [
  { id: "claude", name: "Claude (Anthropic)", description: "Best tool-calling support for FCC operations" },
  { id: "openai", name: "OpenAI", description: "GPT-4o and GPT-4 Turbo models" },
  { id: "gemini", name: "Google Gemini", description: "Gemini 2.0 Flash and Pro models" },
  { id: "deepseek", name: "DeepSeek", description: "Cost-effective reasoning model" },
  { id: "kimi", name: "Kimi (Moonshot)", description: "Long-context model up to 128K tokens" },
];

interface SettingsViewProps {
  /** Called after tenant config is saved/changed so the dashboard can remount with fresh data. */
  onTenantChange?: () => void;
}

export function SettingsView({ onTenantChange }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<"llm" | "tenants">("llm");

  return (
    <div className="h-full flex">
      {/* Settings Nav */}
      <div className="w-52 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-2">
          Configuration
        </h3>
        <nav className="space-y-0.5">
          {[
            { id: "llm" as const, label: "LLM Providers", icon: "✦" },
            { id: "tenants" as const, label: "FCC Tenants", icon: "⇄" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`
                w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                ${activeSection === item.id
                  ? "bg-white/10 text-[var(--color-text)] font-medium"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5"
                }
              `}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeSection === "llm" && <LLMSettings />}
        {activeSection === "tenants" && <TenantSettings onTenantChange={onTenantChange} />}
      </div>
    </div>
  );
}

function LLMSettings() {
  const [providers, setProviders] = useState<ProviderConfig[]>(
    PROVIDERS.map((p) => ({ ...p, apiKey: "", configured: false }))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  // Active LLM selection state
  const [activeProviderId, setActiveProviderId] = useState("claude");
  const [activeModelId, setActiveModelId] = useState("claude-sonnet-4-20250514");

  // Load existing keys + active LLM on mount
  useEffect(() => {
    async function loadKeys() {
      if (!window.fccCommander) return;
      const updated = await Promise.all(
        providers.map(async (p) => {
          const key = await window.fccCommander.getSecureValue(`apiKey.${p.id}`);
          return { ...p, configured: !!key, apiKey: key ? "••••••••••••" : "" };
        })
      );
      setProviders(updated);

      // Load saved active LLM
      const [savedProvider, savedModel] = await Promise.all([
        window.fccCommander.getConfig("llm.provider"),
        window.fccCommander.getConfig("llm.model"),
      ]);
      if (savedProvider) setActiveProviderId(savedProvider as string);
      if (savedModel) setActiveModelId(savedModel as string);
    }
    loadKeys();
  }, []);

  async function testKey(providerId: string, key: string) {
    console.log("[LLM Test] clicked:", providerId, "key length:", key?.length, "key:", key?.slice(0, 6));
    if (!window.fccCommander) { console.log("[LLM Test] no fccCommander"); return; }
    if (!key) { console.log("[LLM Test] no key"); return; }
    if (key === "••••••••••••") { console.log("[LLM Test] masked key, skipping"); return; }
    setTesting(providerId);
    setTestResult((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    try {
      console.log("[LLM Test] calling testApiKey IPC...");
      const result = await window.fccCommander.testApiKey(providerId, key);
      console.log("[LLM Test] result:", result);
      setTestResult((prev) => ({ ...prev, [providerId]: result }));
    } catch (err) {
      console.error("[LLM Test] error:", err);
      setTestResult((prev) => ({
        ...prev,
        [providerId]: { success: false, message: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTesting(null);
    }
  }

  async function saveKey(providerId: string, key: string) {
    console.log("[LLM Save] clicked:", providerId, "key length:", key?.length);
    if (!window.fccCommander) { console.log("[LLM Save] no fccCommander"); return; }
    if (!key) { console.log("[LLM Save] no key"); return; }
    if (key === "••••••••••••") { console.log("[LLM Save] masked key, skipping"); return; }
    setSaving(providerId);
    try {
      console.log("[LLM Save] calling setSecureValue...");
      await window.fccCommander.setSecureValue(`apiKey.${providerId}`, key);
      console.log("[LLM Save] saved successfully");
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, configured: true, apiKey: "••••••••••••" } : p
        )
      );
      setTestResult((prev) => ({
        ...prev,
        [providerId]: { success: true, message: "API key saved successfully." },
      }));
    } catch (err) {
      console.error("[LLM Save] error:", err);
      setTestResult((prev) => ({
        ...prev,
        [providerId]: { success: false, message: `Save failed: ${err instanceof Error ? err.message : String(err)}` },
      }));
    } finally {
      setSaving(null);
    }
  }

  const isKeyEditable = (apiKey: string) => apiKey && apiKey !== "••••••••••••";

  const configuredProviderIds = providers.filter((p) => p.configured).map((p) => p.id);

  async function handleSelectModel(providerId: string, modelId: string) {
    setActiveProviderId(providerId);
    setActiveModelId(modelId);
    if (window.fccCommander) {
      await window.fccCommander.setConfig("llm.provider", providerId);
      await window.fccCommander.setConfig("llm.model", modelId);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: "var(--font-heading)" }}>
        LLM Providers
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Configure API keys for the AI models you want to use. Your keys are encrypted and stored locally.
      </p>

      {/* Active Model Selector */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
          Active Model
        </h3>
        {configuredProviderIds.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Add an API key below to enable a provider.
          </p>
        ) : (
          <div>
            {/* Provider tabs */}
            <div className="flex gap-2 mb-3">
              {LLM_PROVIDERS.filter((lp) => configuredProviderIds.includes(lp.id)).map((lp) => (
                <button
                  key={lp.id}
                  onClick={() => {
                    handleSelectModel(lp.id, lp.defaultModel);
                  }}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                    ${activeProviderId === lp.id
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
                      : "bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10 border border-transparent"
                    }
                  `}
                >
                  <span
                    className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: lp.color }}
                  >
                    {lp.badge}
                  </span>
                  {lp.shortName}
                </button>
              ))}
            </div>
            {/* Models for active provider */}
            {(() => {
              const activeLp = LLM_PROVIDERS.find((lp) => lp.id === activeProviderId);
              if (!activeLp || !configuredProviderIds.includes(activeLp.id)) return null;
              return (
                <div className="space-y-1">
                  {activeLp.models.map((m) => {
                    const isActive = activeModelId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleSelectModel(activeLp.id, m.id)}
                        className={`
                          w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150
                          ${isActive
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                            : "text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-[var(--color-text)]"
                          }
                        `}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-primary)", boxShadow: "0 0 6px var(--color-primary)" }} />
                        )}
                        {!isActive && <span className="w-1.5 h-1.5 flex-shrink-0" />}
                        <span className="flex-1 font-medium">{m.name}</span>
                        {m.contextWindow && (
                          <span className="text-[10px] text-[var(--color-text-secondary)] font-data">
                            {m.contextWindow}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* API Key Cards */}
      <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
        API Keys
      </h3>
      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className="glass-card rounded-xl p-4 hover:border-[var(--color-border-hover)] transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{p.name}</h3>
                  {p.configured && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{p.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={p.apiKey}
                onChange={(e) => {
                  setProviders((prev) =>
                    prev.map((pr) => (pr.id === p.id ? { ...pr, apiKey: e.target.value } : pr))
                  );
                  // Clear test result when key changes
                  setTestResult((prev) => {
                    const next = { ...prev };
                    delete next[p.id];
                    return next;
                  });
                }}
                placeholder={`Enter ${p.name} API key...`}
                className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white/5 text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] font-data"
              />
              <button
                onClick={() => testKey(p.id, p.apiKey)}
                disabled={testing === p.id || !isKeyEditable(p.apiKey)}
                className="px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 text-[var(--color-text-secondary)] bg-white/10 hover:bg-white/15"
              >
                {testing === p.id ? "Testing..." : "Test"}
              </button>
              <button
                onClick={() => saveKey(p.id, p.apiKey)}
                disabled={saving === p.id || !isKeyEditable(p.apiKey)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-40"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                }}
              >
                {saving === p.id ? "Saving..." : "Save"}
              </button>
            </div>

            {/* Test result feedback */}
            {testResult[p.id] && (
              <div
                className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                  testResult[p.id].success
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {testResult[p.id].success ? "✓ " : "✗ "}
                {testResult[p.id].message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Multi-Tenant Types ──────────────────────────────────────────────────────

interface TenantEntry {
  id: string;
  url: string;
  appName: string;
  authMethod: "basic" | "oauth";
  username: string;
}

interface TenantForm {
  isNew: boolean;
  originalId?: string;
  url: string;
  appName: string;
  authMethod: "basic" | "oauth";
  username: string;
  password: string;
}

// ─── TenantSettings ──────────────────────────────────────────────────────────

function TenantSettings({ onTenantChange }: { onTenantChange?: () => void }) {
  const [tenants, setTenants] = useState<TenantEntry[]>([]);
  const [defaultId, setDefaultId] = useState("");
  const [form, setForm] = useState<TenantForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; title: string; detail?: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputClasses =
    "w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white/5 text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";
  const labelClasses =
    "block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5";

  function makeId(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "default"
    );
  }

  // Load on mount — supports legacy single-tenant migration
  useEffect(() => {
    async function load() {
      if (!window.fccCommander) return;
      let list = (await window.fccCommander.getConfig("tenantsList")) as TenantEntry[] | null;
      let def = (await window.fccCommander.getConfig("defaultTenant")) as string | null;

      // Migrate from legacy single-tenant format if needed
      if (!Array.isArray(list) || list.length === 0) {
        const legacy = (await window.fccCommander.getConfig("tenantConfig")) as Record<string, string> | null;
        if (legacy?.url) {
          const id = makeId(legacy.appName || "FCCS");
          list = [
            {
              id,
              url: legacy.url,
              appName: legacy.appName || "FCCS",
              authMethod: (legacy.authMethod as "basic" | "oauth") || "basic",
              username: legacy.username || "",
            },
          ];
          def = id;
          // Migrate the secure password to the new per-tenant key
          const pw = await window.fccCommander.getSecureValue("tenant.password");
          if (pw) await window.fccCommander.setSecureValue(`tenant.password.${id}`, pw);
          await window.fccCommander.setConfig("tenantsList", list);
          await window.fccCommander.setConfig("defaultTenant", def);
        }
      }

      if (list) setTenants(list);
      if (def) setDefaultId(def);
    }
    load();
  }, []);

  /** Persist list + default, then rebuild the live FccClientManager. */
  async function rebuildAndActivate(list: TenantEntry[], def: string) {
    if (!window.fccCommander) return;
    const resolvedDefault = def || list[0]?.id || "";
    await window.fccCommander.setConfig("tenantsList", list);
    await window.fccCommander.setConfig("defaultTenant", resolvedDefault);

    const tenantsMap: Record<string, unknown> = {};
    for (const t of list) {
      const pw = (await window.fccCommander.getSecureValue(`tenant.password.${t.id}`)) || "";
      tenantsMap[t.id] = {
        url: t.url.replace(/\/+$/, ""),
        app: t.appName,
        auth: t.authMethod,
        username: t.username,
        password: pw,
      };
    }
    await window.fccCommander.configureTenants({
      defaultTenant: resolvedDefault,
      tenants: tenantsMap,
    });
    // Notify App so DashboardView remounts with fresh dimension data for the new tenant
    onTenantChange?.();
  }

  function openAddForm() {
    setForm({ isNew: true, url: "", appName: "", authMethod: "basic", username: "", password: "" });
    setStatus(null);
  }

  async function openEditForm(t: TenantEntry) {
    const hasPw = !!(await window.fccCommander?.getSecureValue(`tenant.password.${t.id}`));
    setForm({
      isNew: false,
      originalId: t.id,
      url: t.url,
      appName: t.appName,
      authMethod: t.authMethod,
      username: t.username,
      password: hasPw ? "••••••••" : "",
    });
    setStatus(null);
  }

  function closeForm() {
    setForm(null);
    setStatus(null);
  }

  async function handleDelete(id: string) {
    if (!window.fccCommander) return;
    setDeletingId(id);
    try {
      const updated = tenants.filter((t) => t.id !== id);
      const newDefault = id === defaultId ? (updated[0]?.id || "") : defaultId;
      setTenants(updated);
      setDefaultId(newDefault);
      // Clear the secure password for this tenant
      await window.fccCommander.setSecureValue(`tenant.password.${id}`, "");
      await rebuildAndActivate(updated, newDefault);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setDefaultId(id);
    await rebuildAndActivate(tenants, id);
  }

  async function handleSave() {
    if (!form || !window.fccCommander) return;
    if (!form.url) {
      setStatus({ type: "error", title: "Environment URL is required." });
      return;
    }
    if (!form.appName) {
      setStatus({ type: "error", title: "Application Name is required." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const newId = makeId(form.appName || "default");
      const originalId = form.originalId || newId;

      // Resolve the password
      const actualPw =
        form.password === "••••••••"
          ? (await window.fccCommander.getSecureValue(`tenant.password.${originalId}`)) || ""
          : form.password;
      if (actualPw && actualPw !== "••••••••") {
        await window.fccCommander.setSecureValue(`tenant.password.${newId}`, actualPw);
      } else if (!form.isNew && originalId !== newId) {
        // App name changed → copy password to new key
        const oldPw = (await window.fccCommander.getSecureValue(`tenant.password.${originalId}`)) || "";
        if (oldPw) await window.fccCommander.setSecureValue(`tenant.password.${newId}`, oldPw);
      }

      const entry: TenantEntry = {
        id: newId,
        url: form.url.replace(/\/+$/, ""),
        appName: form.appName || newId,
        authMethod: form.authMethod,
        username: form.username,
      };

      let updated: TenantEntry[];
      let newDefault: string;
      if (form.isNew) {
        updated = [...tenants, entry];
        newDefault = tenants.length === 0 ? newId : defaultId; // first tenant becomes default
      } else {
        updated = tenants.map((t) => (t.id === originalId ? entry : t));
        newDefault = defaultId === originalId ? newId : defaultId;
      }

      setTenants(updated);
      setDefaultId(newDefault);
      await rebuildAndActivate(updated, newDefault);

      // Test connection with new config before finalizing
      try {
        await window.fccCommander.configureTenants({
          defaultTenant: entry.id,
          tenants: {
            [entry.id]: {
              url: entry.url,
              app: entry.appName,
              auth: entry.authMethod,
              username: entry.username,
              password: actualPw,
            },
          },
        });
        const testResult = (await window.fccCommander.executeTool("fcc_test_connection", {})) as unknown as Record<string, unknown>;
        const testFailed = testResult?.isError === true || testResult?.success === false;
        if (testFailed) {
          const errText = (testResult?.content as Array<{ text?: string }>)?.[0]?.text || String(testResult?.message || "Connection test failed");
          // Show warning but still save - don't block the save
          setStatus({ type: "error", title: "Saved with connection warning", detail: errText });
          return;
        }
      } catch {
        // Ignore test errors — save proceeds regardless
      }

      setStatus({ type: "success", title: form.isNew ? "Tenant added successfully." : "Tenant updated successfully." });
      setTimeout(closeForm, 1200);
    } catch (err) {
      setStatus({ type: "error", title: "Save failed", detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!form || !window.fccCommander || !form.url) {
      setStatus({ type: "error", title: "Environment URL is required." });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      const id = makeId(form.appName || "default");
      const originalId = form.originalId || id;
      const actualPw =
        form.password === "••••••••"
          ? (await window.fccCommander.getSecureValue(`tenant.password.${originalId}`)) || ""
          : form.password;

      // Temporarily configure just this tenant so the test connection tool can run
      await window.fccCommander.configureTenants({
        defaultTenant: id,
        tenants: {
          [id]: {
            url: form.url.replace(/\/+$/, ""),
            app: form.appName || id,
            auth: form.authMethod,
            username: form.username,
            password: actualPw,
          },
        },
      });

      const result = (await window.fccCommander.executeTool(
        "fcc_test_connection",
        {}
      )) as unknown as Record<string, unknown>;
      const isError = result?.isError === true || result?.success === false;

      if (isError) {
        const text = (result?.content as Array<{ text?: string }>)?.[0]?.text;
        setStatus({ type: "error", title: "Connection failed", detail: text || String(result?.message || "Unknown error") });
      } else {
        setStatus({ type: "success", title: "Connection successful", detail: "Connected to the FCC environment." });
      }
    } catch (err) {
      setStatus({ type: "error", title: "Connection failed", detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  // ─── Status Banner ────────────────────────────────────────────────────────
  function StatusBanner() {
    if (!status) return null;
    return (
      <div
        className={`px-4 py-3 rounded-lg text-sm ${
          status.type === "success"
            ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20"
            : "bg-red-500/10 border border-red-500/20"
        }`}
      >
        <div
          className={`font-semibold flex items-center gap-1.5 ${
            status.type === "success" ? "text-[var(--color-primary)]" : "text-red-400"
          }`}
        >
          <span>{status.type === "success" ? "✓" : "✗"}</span>
          {status.title}
        </div>
        {status.detail && (
          <p className={`mt-1 text-xs ${status.type === "success" ? "text-[var(--color-primary)]/80" : "text-red-400/80"}`}>
            {status.detail}
          </p>
        )}
      </div>
    );
  }

  // ─── Form View (Add / Edit) ───────────────────────────────────────────────
  if (form !== null) {
    return (
      <div className="max-w-2xl">
        {/* Back header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={closeForm}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors text-base"
          >
            ←
          </button>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-heading)" }}>
              {form.isNew ? "Add FCC Tenant" : "Edit FCC Tenant"}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Configure your Oracle FCC environment connection.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <div className="space-y-4">
            {/* URL */}
            <div>
              <label className={labelClasses}>Environment URL</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => f && { ...f, url: e.target.value })}
                placeholder="https://your-instance.oraclecloud.com"
                className={`${inputClasses} font-data`}
              />
            </div>

            {/* App Name + Auth Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Application Name</label>
                <input
                  type="text"
                  value={form.appName}
                  onChange={(e) => setForm((f) => f && { ...f, appName: e.target.value })}
                  placeholder="e.g. FCCS"
                  className={`${inputClasses} font-data`}
                />
              </div>
              <div>
                <label className={labelClasses}>Auth Method</label>
                <select
                  value={form.authMethod}
                  onChange={(e) => setForm((f) => f && { ...f, authMethod: e.target.value as "basic" | "oauth" })}
                  className={inputClasses}
                >
                  <option value="basic">Basic Auth</option>
                  <option value="oauth">OAuth 2.0</option>
                </select>
              </div>
            </div>

            {/* Username + Password */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => f && { ...f, username: e.target.value })}
                  placeholder="admin@company.com"
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => f && { ...f, password: e.target.value })}
                  onFocus={() => {
                    if (form.password === "••••••••") setForm((f) => f && { ...f, password: "" });
                  }}
                  placeholder="••••••••"
                  className={inputClasses}
                />
              </div>
            </div>

            <StatusBanner />

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.url}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-primary)" }}
              >
                {saving ? "Saving..." : "Save & Connect"}
              </button>
              <button
                onClick={handleTest}
                disabled={testing || !form.url}
                className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            FCC Tenants
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Configure Oracle FCC environments. The AI Chat agent can operate across all configured tenants.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white transition-opacity flex-shrink-0"
          style={{ background: "var(--color-primary)" }}
        >
          <span className="text-base leading-none">+</span>
          Add Tenant
        </button>
      </div>

      {tenants.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">⇄</div>
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">No tenants configured</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            Add your first Oracle FCC environment to get started.
          </p>
          <button
            onClick={openAddForm}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Add FCC Environment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => {
            const initials = t.appName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "FC";
            const isDefault = t.id === defaultId;
            return (
              <div
                key={t.id}
                className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-[var(--color-border-hover)] transition-all duration-200"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                    color: "var(--color-primary)",
                  }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{t.appName}</span>
                    {isDefault && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5 font-data">{t.url}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]/60 mt-0.5">
                    {t.authMethod === "basic" ? "Basic Auth" : "OAuth 2.0"}
                    {t.username ? ` · ${t.username}` : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isDefault && (
                    <button
                      onClick={() => handleSetDefault(t.id)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => openEditForm(t)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {deletingId === t.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

