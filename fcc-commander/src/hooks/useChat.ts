import { useState, useRef, useEffect, useCallback } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallRecord[];
  isError?: boolean;
}

export interface ToolCallRecord {
  toolName: string;
  args: unknown;
  result: unknown;
}

interface UseChatOptions {
  provider: string;
  model: string;
}

export function useChat({ provider, model }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Track the last assistant message id during streaming
  const streamingMsgId = useRef<string | null>(null);

  // Wire up IPC stream listeners
  useEffect(() => {
    if (!window.fccCommander) return;

    const cleanups = [
      window.fccCommander.onChatStream((chunk) => {
        setStreamBuffer((prev) => prev + chunk);
      }),

      window.fccCommander.onChatToolCall((data) => {
        if (!streamingMsgId.current) return;
        const id = streamingMsgId.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, toolCalls: [...(m.toolCalls ?? []), data as ToolCallRecord] }
              : m
          )
        );
      }),

      window.fccCommander.onChatDone((fullText) => {
        if (streamingMsgId.current) {
          const id = streamingMsgId.current;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: fullText } : m))
          );
        }
        streamingMsgId.current = null;
        setStreamBuffer("");
        setStreaming(false);
        setError(null);
      }),

      window.fccCommander.onChatError((errMsg) => {
        if (streamingMsgId.current) {
          const id = streamingMsgId.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, content: errMsg, isError: true } : m
            )
          );
        }
        streamingMsgId.current = null;
        setStreamBuffer("");
        setStreaming(false);
        setError(errMsg);
      }),
    ];

    return () => cleanups.forEach((c) => c());
  }, []); // Only mount once — IPC events are global

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      streamingMsgId.current = assistantMsg.id;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setStreamBuffer("");

      if (window.fccCommander) {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));
        await window.fccCommander.sendChatMessage(history, provider, model);
      }
    },
    [streaming, messages, provider, model]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamBuffer("");
    setError(null);
  }, []);

  return {
    messages,
    streaming,
    streamBuffer,
    streamingMsgId: streamingMsgId.current,
    error,
    sendMessage,
    clearMessages,
  };
}
