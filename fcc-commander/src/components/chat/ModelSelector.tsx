import React, { useState, useRef, useEffect } from "react";
import { LLM_PROVIDERS, type LlmProvider } from "../../constants/providers";

interface ModelSelectorProps {
  providerId: string;
  modelId: string;
  configuredProviders: string[];
  onChange: (providerId: string, modelId: string) => void;
}

export function ModelSelector({
  providerId,
  modelId,
  configuredProviders,
  onChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProvider = LLM_PROVIDERS.find((p) => p.id === providerId);
  const currentModel = currentProvider?.models.find((m) => m.id === modelId);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors duration-150 group"
      >
        {/* Provider badge */}
        <span
          className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0"
          style={{ background: currentProvider?.color ?? "#6b7280" }}
        >
          {currentProvider?.badge ?? "?"}
        </span>
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]">
          {currentProvider?.shortName ?? "Unknown"} · {currentModel?.name ?? modelId.split("-")[0]}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)]/50">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 glass-elevated rounded-xl shadow-xl z-50 w-64 py-1 animate-slide-up">
          {LLM_PROVIDERS.map((provider) => {
            const configured = configuredProviders.includes(provider.id);
            return (
              <div key={provider.id}>
                {/* Provider header */}
                <div className="flex items-center gap-2 px-3 py-2 mt-1 first:mt-0">
                  <span
                    className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: provider.color }}
                  >
                    {provider.badge}
                  </span>
                  <span className="text-xs font-semibold text-[var(--color-text)]">
                    {provider.name}
                  </span>
                  {!configured && (
                    <span className="ml-auto text-[10px] text-[var(--color-text-secondary)]/50 font-medium">
                      No key
                    </span>
                  )}
                </div>

                {/* Models */}
                {configured && (
                  <div className="mb-1">
                    {provider.models.map((m) => {
                      const active = providerId === provider.id && modelId === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onChange(provider.id, m.id);
                            setOpen(false);
                          }}
                          className={`
                            w-full text-left flex items-center gap-2 px-4 py-1.5 text-xs transition-colors duration-150
                            ${active
                              ? "bg-[var(--color-primary)]/10 text-[var(--color-text)] font-semibold"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5"
                            }
                          `}
                        >
                          <span className="flex-1">{m.name}</span>
                          {m.contextWindow && (
                            <span className="text-[10px] text-[var(--color-text-secondary)]/50 font-data">
                              {m.contextWindow}
                            </span>
                          )}
                          {active && <span className="text-[var(--color-primary)] text-[10px]">●</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!configured && (
                  <p className="px-4 pb-2 text-[10px] text-[var(--color-text-secondary)]/50">
                    Add API key in Settings
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
