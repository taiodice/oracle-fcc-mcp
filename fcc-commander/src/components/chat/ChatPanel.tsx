import React, { useState, useRef, useEffect } from "react";
import { X, Trash2, Send, Loader2, Sparkles } from "lucide-react";
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
  const [providerId, setProviderId] = useState("claude");
  const [modelId, setModelId] = useState("claude-sonnet-4-20250514");
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);

  const { messages, streaming, streamBuffer, error, sendMessage, clearMessages } =
    useChat({ provider: providerId, model: modelId });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

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
      className="h-full flex flex-col flex-shrink-0 animate-slide-right"
      style={{
        width: "360px",
        background: "rgba(7,17,31,0.95)",
        borderLeft: "1px solid rgba(25,197,163,0.12)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(25,197,163,0.15)", color: "#19C5A3" }}
          >
            <Sparkles size={14} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight" style={{ color: "#E2EBF5" }}>
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
        <div className="flex items-center gap-1 flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150"
              style={{ color: "#7096B8" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#E2EBF5")}
              onMouseLeave={e => (e.currentTarget.style.color = "#7096B8")}
              title="Clear chat"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150"
            style={{ color: "#7096B8" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#E2EBF5")}
            onMouseLeave={e => (e.currentTarget.style.color = "#7096B8")}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* No API Key Banner */}
      {noKeysConfigured && (
        <div
          className="mx-3 mt-3 p-3 rounded-xl flex-shrink-0"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "#F59E0B" }}>
            No API key configured
          </p>
          <p className="text-xs mb-2 leading-relaxed" style={{ color: "#94A3B8" }}>
            Add an API key for Claude, OpenAI, Gemini, or DeepSeek to start.
          </p>
          <button
            onClick={onNavigateToSettings}
            className="text-xs font-semibold underline underline-offset-2"
            style={{ color: "#F59E0B" }}
          >
            Go to Settings →
          </button>
        </div>
      )}

      {!noKeysConfigured && !currentHasKey && (
        <div
          className="mx-3 mt-3 p-3 rounded-xl flex-shrink-0 text-xs"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#7096B8",
          }}
        >
          No key for <strong style={{ color: "#B4CCE5" }}>{LLM_PROVIDERS.find((p) => p.id === providerId)?.name}</strong>.{" "}
          Switch provider or{" "}
          <button
            onClick={onNavigateToSettings}
            className="underline underline-offset-2"
            style={{ color: "#19C5A3" }}
          >
            add a key
          </button>.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 dark-scroll space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-4 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(25,197,163,0.1)", color: "#19C5A3" }}
            >
              <Sparkles size={22} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#E2EBF5" }}>
              Ask anything about FCC
            </p>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: "#7096B8" }}>
              Check entity status, run consolidations, manage journals, promote entities, and more.
            </p>
            <div className="space-y-2 w-full">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={!currentHasKey || streaming}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#94A3B8",
                  }}
                  onMouseEnter={e => {
                    if (!e.currentTarget.disabled) {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(25,197,163,0.3)";
                      (e.currentTarget as HTMLElement).style.color = "#E2EBF5";
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          return (
            <div key={msg.id} className="animate-slide-up">
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div
                    className="max-w-[88%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                    style={{ background: "rgba(25,197,163,0.15)", color: "#E2EBF5", border: "1px solid rgba(25,197,163,0.2)" }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(25,197,163,0.15)", color: "#19C5A3" }}
                  >
                    <Sparkles size={11} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {msg.toolCalls?.map((tc, ti) => (
                      <ToolCallCard key={ti} toolCall={tc} />
                    ))}
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                      style={{ color: msg.isError ? "#EF4444" : "#B4CCE5" }}
                    >
                      {isLast && streaming && !msg.content ? (
                        streamBuffer || (
                          <span
                            className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse"
                            style={{ background: "#19C5A3" }}
                          />
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

      {/* Input */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2 transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={() => {}}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentHasKey ? "Ask about FCC..." : "Configure an API key first..."}
            disabled={!currentHasKey}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none disabled:cursor-not-allowed"
            style={{
              fontFamily: "var(--font-body)",
              minHeight: "20px",
              color: "#E2EBF5",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || !currentHasKey}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0 disabled:opacity-30"
            style={{ background: "rgba(25,197,163,0.2)", color: "#19C5A3" }}
          >
            {streaming ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Send size={13} strokeWidth={2} />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <span className="text-[10px]" style={{ color: "#4A6280" }}>⏎ Send · Shift+⏎ New line</span>
          {error && (
            <span className="text-[10px] truncate max-w-[60%]" style={{ color: "#EF4444" }} title={error}>
              ⚠ {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
