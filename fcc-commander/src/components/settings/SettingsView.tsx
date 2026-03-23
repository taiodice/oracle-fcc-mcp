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

export function SettingsView() {
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
        {activeSection === "tenants" && <TenantSettings />}
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

function TenantSettings() {
  const [url, setUrl] = useState("");
  const [appName, setAppName] = useState("FCCS");
  const [authMethod, setAuthMethod] = useState<"basic" | "oauth">("basic");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; title: string; detail?: string } | null>(null);

  // Load saved tenant config on mount
  useEffect(() => {
    async function load() {
      if (!window.fccCommander) return;
      const saved = await window.fccCommander.getConfig("tenantConfig");
      if (saved && typeof saved === "object") {
        const cfg = saved as Record<string, string>;
        if (cfg.url) setUrl(cfg.url);
        if (cfg.appName) setAppName(cfg.appName);
        if (cfg.authMethod) setAuthMethod(cfg.authMethod as "basic" | "oauth");
        if (cfg.username) setUsername(cfg.username);
      }
      // Load password from secure storage
      const pw = await window.fccCommander.getSecureValue("tenant.password");
      if (pw) setPassword("••••••••");
    }
    load();
  }, []);

  function buildTenantConfig(pw?: string) {
    const tenantId = appName.toLowerCase().replace(/\s+/g, "-") || "default";
    return {
      defaultTenant: tenantId,
      tenants: {
        [tenantId]: {
          url: url.replace(/\/+$/, ""),
          app: appName || "FCCS",
          auth: authMethod,
          username,
          password: pw || password,
        },
      },
    };
  }

  function extractErrorDetail(result: Record<string, unknown>): string {
    // Extract human-readable error from various result formats
    const content = result?.content as Array<{ text?: string }> | undefined;
    const contentText = content?.[0]?.text;
    if (contentText) return contentText;
    if (typeof result?.message === "string") return result.message;
    // Filter out noisy fields for display
    const { success, isError, ...rest } = result;
    void success; void isError;
    const json = JSON.stringify(rest);
    return json !== "{}" ? json : "Unknown error";
  }

  async function handleSaveAndConnect() {
    if (!window.fccCommander || !url) {
      setStatus({ type: "error", title: "Configuration Error", detail: "Environment URL is required." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      // Store password securely (don't persist in plain config)
      const actualPassword = password === "••••••••" ? (await window.fccCommander.getSecureValue("tenant.password")) || "" : password;
      if (actualPassword && actualPassword !== "••••••••") {
        await window.fccCommander.setSecureValue("tenant.password", actualPassword);
      }

      // Save non-secret config
      await window.fccCommander.setConfig("tenantConfig", {
        url: url.replace(/\/+$/, ""),
        appName: appName || "FCCS",
        authMethod,
        username,
      });

      // Configure the FCC client in the main process
      const result = await window.fccCommander.configureTenants(buildTenantConfig(actualPassword));
      if (result && (result as { success?: boolean }).success !== false) {
        setStatus({ type: "success", title: "Connection Successful", detail: "Tenant configuration saved and connected to FCC environment." });
      } else {
        setStatus({ type: "error", title: "Connection Failed", detail: "Tenant saved but could not connect. Please verify your credentials and environment URL." });
      }
    } catch (err) {
      setStatus({ type: "error", title: "Connection Failed", detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!window.fccCommander || !url) {
      setStatus({ type: "error", title: "Configuration Error", detail: "Environment URL is required." });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      // First configure tenants so the client is initialized
      const actualPassword = password === "••••••••" ? (await window.fccCommander.getSecureValue("tenant.password")) || "" : password;
      await window.fccCommander.configureTenants(buildTenantConfig(actualPassword));

      // Then test the connection
      const result = await window.fccCommander.executeTool("fcc_test_connection", {}) as Record<string, unknown>;

      // Check all possible error indicators
      const isError = result?.isError === true || result?.success === false;

      if (isError) {
        setStatus({
          type: "error",
          title: "Connection Failed",
          detail: extractErrorDetail(result),
        });
      } else {
        setStatus({
          type: "success",
          title: "Connection Successful",
          detail: "Successfully connected to the FCC environment.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        title: "Connection Failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }

  const inputClasses = "w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white/5 text-[var(--color-text)] placeholder-[var(--color-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]";

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: "var(--font-heading)" }}>
        FCC Tenants
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Configure your Oracle FCC environment connections. Supports both Basic and OAuth authentication.
      </p>

      <div className="glass-card rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Environment URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-instance.oraclecloud.com"
              className={`${inputClasses} font-data`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Application Name
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. FCCS"
                className={`${inputClasses} font-data`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Auth Method
              </label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as "basic" | "oauth")}
                className={inputClasses}
              >
                <option value="basic">Basic Auth</option>
                <option value="oauth">OAuth 2.0</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@company.com"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => { if (password === "••••••••") setPassword(""); }}
                placeholder="••••••••"
                className={inputClasses}
              />
            </div>
          </div>

          {/* Status banner */}
          {status && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                status.type === "success"
                  ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <div className={`font-semibold flex items-center gap-1.5 ${
                status.type === "success" ? "text-[var(--color-primary)]" : "text-red-400"
              }`}>
                <span className="text-base">{status.type === "success" ? "✓" : "✗"}</span>
                {status.title}
              </div>
              {status.detail && (
                <p className={`mt-1 text-xs ${
                  status.type === "success" ? "text-[var(--color-primary)]/80" : "text-red-400/80"
                }`}>
                  {status.detail}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveAndConnect}
              disabled={saving || !url}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-opacity disabled:opacity-40"
              style={{ background: "var(--color-primary)" }}
            >
              {saving ? "Saving..." : "Save & Connect"}
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing || !url}
              className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] bg-white/10 hover:bg-white/15 transition-colors duration-150 disabled:opacity-40"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

