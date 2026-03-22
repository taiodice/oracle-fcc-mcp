import React, { useState, useEffect } from "react";

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
  const [activeSection, setActiveSection] = useState<"llm" | "tenants" | "branding">("llm");

  return (
    <div className="h-full flex">
      {/* Settings Nav */}
      <div className="w-52 border-r border-slate-200/80 bg-white p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
          Configuration
        </h3>
        <nav className="space-y-0.5">
          {[
            { id: "llm" as const, label: "LLM Providers", icon: "✦" },
            { id: "tenants" as const, label: "FCC Tenants", icon: "⇄" },
            { id: "branding" as const, label: "Branding", icon: "◎" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`
                w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                ${activeSection === item.id
                  ? "bg-slate-100 text-slate-800 font-medium"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
        {activeSection === "branding" && <BrandingSettings />}
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

  // Load existing keys on mount
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

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
        LLM Providers
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Configure API keys for the AI models you want to use. Your keys are encrypted and stored locally.
      </p>

      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-slate-200/80 p-4 hover:shadow-sm transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{p.name}</h3>
                  {p.configured && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
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
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-data"
              />
              <button
                onClick={() => testKey(p.id, p.apiKey)}
                disabled={testing === p.id || !isKeyEditable(p.apiKey)}
                className="px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 text-slate-600 bg-slate-100 hover:bg-slate-200"
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
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
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

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
        FCC Tenants
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Configure your Oracle FCC environment connections. Supports both Basic and OAuth authentication.
      </p>

      <div className="bg-white rounded-xl border border-slate-200/80 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Environment URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-instance.oraclecloud.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-data"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Application Name
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. FCCS"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-data"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Auth Method
              </label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as "basic" | "oauth")}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              >
                <option value="basic">Basic Auth</option>
                <option value="oauth">OAuth 2.0</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@company.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => { if (password === "••••••••") setPassword(""); }}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Status banner */}
          {status && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                status.type === "success"
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className={`font-semibold flex items-center gap-1.5 ${
                status.type === "success" ? "text-emerald-700" : "text-red-700"
              }`}>
                <span className="text-base">{status.type === "success" ? "✓" : "✗"}</span>
                {status.title}
              </div>
              {status.detail && (
                <p className={`mt-1 text-xs ${
                  status.type === "success" ? "text-emerald-600" : "text-red-600"
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
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-150 disabled:opacity-40"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandingSettings() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
        Branding
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Customize the look and feel of FCC Commander for your organization.
      </p>

      <div className="bg-white rounded-xl border border-slate-200/80 p-6">
        <p className="text-sm text-slate-500">
          Branding is configured via the <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-data">brand.json</code> file
          at build time. To create a white-label version for a client, add a new folder in{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-data">branding/[client-name]/</code> with
          a custom <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-data">brand.json</code> and logo files.
        </p>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <pre className="text-xs font-data text-slate-600 whitespace-pre-wrap">
{`npm run build:brand -- --brand=acme-corp
# Produces: "Acme Corp FCC Commander Setup.exe"`}
          </pre>
        </div>
      </div>
    </div>
  );
}
