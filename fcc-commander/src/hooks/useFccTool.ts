import { useState, useCallback } from "react";
import type { ToolResult } from "../types/electron";

interface UseFccToolReturn {
  execute: (toolName: string, args?: Record<string, unknown>) => Promise<ToolResult>;
  loading: boolean;
  error: string | null;
  result: ToolResult | null;
}

export function useFccTool(): UseFccToolReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);

  const execute = useCallback(
    async (toolName: string, args: Record<string, unknown> = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.fccCommander.executeTool(toolName, args);
        setResult(res);
        if (!res.success) {
          setError(res.message);
        }
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        const failResult: ToolResult = { success: false, message: msg };
        setResult(failResult);
        return failResult;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { execute, loading, error, result };
}
