import React, { useState, useRef, useEffect } from "react";
import { useChat } from "../../hooks/useChat";
import { ModelSelector } from "./ModelSelector";
import { ToolCallCard } from "./ToolCallCard";
import { LLM_PROVIDERS } from "../../constants/providers";

interface ChatPanelProps {
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

const EXAMPLE_PROMPTS = [
  "Show entity approval status for Actual / FY25 / Jan",
  "Promote all base entities to Group Finance",
  "Run consolidation for Q1 FY25",
  "Which periods are locked in the current scenario?",
];

export function ChatPanel({ onClose, onNavigateToSettings }: ChatPanelProps) {
  // LLM selection — persisted to config
  const [providerId, setProviderId] = useState("claude");
  const [modelId, setModelId] = useState("claude-sonnet-4-20250514");
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);

  const { messages, streaming, streamBuffer, error, sendMessage, clearMessages } =
    useChat({ provider: providerId, model: modelId });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load configured providers and saved LLM preference
  useEffect(() => {
    async function init() {
      if (!window.fccCommander) return;

      const [configured, savedProvider, savedModel] = await Promise.all([
        window.fccCommander.getConfiguredProviders(),
        window.fccCommander.getConfig("llm.provider"),
        window.fccCommander.getConfig("llm.model"),
      ]);

      setConfiguredProviders(configured as string[]);
      if (savedProvider) setProviderId(savedProvider as string);
      if (savedModel) setModelId(savedModel as string);
    }
    init();
  }, []);

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  const handleModelChange = async (newProvider: string, newModel: string) => {
    setProviderId(newProvider);
    setModelId(newModel);
    if (window.fccCommander) {
      await Promise.all([
        window.fccCommander.setConfig("llm.provider", newProvider),
        window.fccCommander.setConfig("llm.model", newModel),
      ]);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentHasKey = configuredProviders.includes(providerId);
  const noKeysConfigured = configuredProviders.length === 0;

  return (
    <div
      className="h-full flex flex-col border-l border-slate-200/80 bg-white animate-slide-right"
      style={{ width: "var(--chat-panel-width)", minWidth: "360px" }}
    >
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: "var(--color-accent)", color: "var(--color-sidebar)" }}
          >
            ✦
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 leading-tight">
              AI Assistant
            </div>
            <ModelSelector
              providerId={providerId}
              modelId={modelId}
              configuredProviders={configuredProviders}
              onChange={handleModelChange}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-[10px] text-slate-300 hover:text-slate-500 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors duration-150"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── No API Key Banner ────────────────────────────────────────── */}
      {noKeysConfigured && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex-shrink-0">
          <p className="text-xs font-semibold text-amber-800 mb-1">No API key configured</p>
          <p className="text-xs text-amber-700 mb-2 leading-relaxed">
            Add an API key for Claude, OpenAI, Gemini, DeepSeek, or Kimi to start chatting.
          </p>
          <button
            onClick={onNavigateToSettings}
            className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Go to Settings →
          </button>
        </div>
      )}

      {!noKeysConfigured && !currentHasKey && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 flex-shrink-0">
          <p className="text-xs text-slate-500">
            No key for <strong>{LLM_PROVIDERS.find((p) => p.id === providerId)?.name}</strong>.
            {" "}Switch provider or{" "}
            <button
              onClick={onNavigateToSettings}
              className="text-amber-600 underline underline-offset-2 hover:text-amber-700"
            >
              add a key
            </button>.
          </p>
        </div>
      )}

      {/* ─── Messages ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 dark-scroll space-y-5">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-4 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg mb-4"
              style={{ background: "var(--color-accent)15", color: "var(--color-accent)" }}
            >
              ✦
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Ask anything about FCC
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              I can check entity status, run consolidations,
              manage journals, promote entities, and more.
            </p>
            <div className="space-y-2 w-full">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={!currentHasKey || streaming}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          return (
            <div key={msg.id} className="animate-slide-up">
              {msg.role === "user" ? (
                /* ── User bubble ── */
                <div className="flex justify-end">
                  <div
                    className="max-w-[88%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm text-white leading-relaxed"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* ── Assistant bubble ── */
                <div className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "var(--color-accent)", color: "var(--color-sidebar)" }}
                  >
                    ✦
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Tool call cards */}
                    {msg.toolCalls?.map((tc, ti) => (
                      <ToolCallCard key={ti} toolCall={tc} />
                    ))}

                    {/* Message text */}
                    <div
                      className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.isError ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {isLast && streaming && !msg.content ? (
                        /* Streaming in progress — show buffer */
                        streamBuffer || (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse"
                              style={{ background: "var(--color-accent)" }}
                            />
                          </span>
                        )
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ─── Input ───────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100 flex-shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/80 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/10 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentHasKey ? "Ask about FCC..." : "Configure an API key first..."}
            disabled={!currentHasKey}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none text-slate-700 placeholder-slate-400 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-body)", minHeight: "20px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || !currentHasKey}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all duration-200 flex-shrink-0 disabled:opacity-30 hover:opacity-90"
            style={{ background: "var(--color-primary)" }}
          >
            {streaming ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-sm">↑</span>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[10px] text-slate-300">⏎ Send · Shift+⏎ New line</span>
          {error && (
            <span className="text-[10px] text-red-400 truncate max-w-[60%]" title={error}>
              ⚠ {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
