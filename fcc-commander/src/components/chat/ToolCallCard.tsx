import React, { useState } from "react";
import type { ToolCallRecord } from "../../hooks/useChat";

interface ToolCallCardProps {
  toolCall: ToolCallRecord;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const result = toolCall.result as { success?: boolean; message?: string; data?: unknown } | null;
  const success = result?.success !== false;

  return (
    <div
      className={`mb-2 rounded-lg border text-xs overflow-hidden transition-all duration-200 ${
        success
          ? "border-emerald-100 bg-emerald-50/60"
          : "border-red-100 bg-red-50/60"
      }`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className={success ? "text-emerald-500" : "text-red-400"}>
          {success ? "⚡" : "✕"}
        </span>
        <span className="font-data font-medium text-slate-600 flex-1">
          {toolCall.toolName}
        </span>
        {result?.message && (
          <span className={`truncate max-w-[120px] ${success ? "text-emerald-600" : "text-red-500"}`}>
            {result.message}
          </span>
        )}
        <span className="text-slate-300 ml-1">{expanded ? "▴" : "▾"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-current border-opacity-10 px-3 py-2 space-y-2">
          {/* Args */}
          {((): React.ReactNode => {
            const args = toolCall.args;
            if (!args || typeof args !== "object" || Object.keys(args as object).length === 0) return null;
            return (
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Input
                </div>
                <pre className="font-data text-[10px] text-slate-500 whitespace-pre-wrap break-all">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            );
          })()}

          {/* Result data */}
          {result?.data !== undefined && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Result
              </div>
              <pre className="font-data text-[10px] text-slate-500 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {JSON.stringify(result.data, null, 2) as string}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
