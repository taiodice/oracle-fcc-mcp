// Chat IPC handler — bridges LLM calls with FCC tools via Vercel AI SDK

import type { IpcMain } from "electron";
import { streamText, tool, jsonSchema } from "ai";
import type { CoreTool } from "ai";
import type { RegisteredTool } from "./tool-registry.js";
import { createLlmProvider } from "../llm/provider-factory.js";
import { FCC_SYSTEM_PROMPT } from "../llm/system-prompt.js";
import { auditLogger } from "../audit/audit-logger.js";

export function setupChatHandler(
  ipcMain: IpcMain,
  getTools: () => RegisteredTool[]
) {
  ipcMain.handle(
    "chat:send",
    async (event, messages: Array<{ role: string; content: string }>, provider: string, model: string) => {
      try {
        // Get the configured LLM provider
        const llmModel = createLlmProvider(provider, model);

        // Convert FCC tools to AI SDK format
        const fccTools = convertToolsToAiSdk(getTools());

        // Stream the response
        const result = streamText({
          model: llmModel,
          system: FCC_SYSTEM_PROMPT,
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          tools: fccTools,
          maxSteps: 10,
          onStepFinish: (step) => {
            // Notify renderer about tool calls
            if (step.toolCalls && step.toolCalls.length > 0) {
              for (const tc of step.toolCalls) {
                const toolResult = (step.toolResults as Array<{ toolCallId: string; result: unknown }> | undefined)
                  ?.find((r) => r.toolCallId === tc.toolCallId);
                event.sender.send("chat:tool", {
                  toolName: tc.toolName,
                  args: tc.args,
                  result: toolResult?.result,
                });
              }
            }
          },
        });

        // Stream text chunks to renderer
        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          event.sender.send("chat:stream", chunk);
        }

        event.sender.send("chat:done", fullText);
        return { success: true, text: fullText };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        event.sender.send("chat:error", message);
        return { success: false, error: message };
      }
    }
  );
}

function convertToolsToAiSdk(
  mcpTools: RegisteredTool[]
): Record<string, CoreTool> {
  const aiTools: Record<string, CoreTool> = {};

  for (const t of mcpTools) {
    aiTools[t.name] = tool({
      description: t.description,
      parameters: jsonSchema(t.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args) => {
        const start = Date.now();
        try {
          const result = await t.handler(args as Record<string, unknown>);
          auditLogger.log({
            source: "chat",
            toolName: t.name,
            args: args as Record<string, unknown>,
            result,
            success: true,
            durationMs: Date.now() - start,
          });
          return result;
        } catch (err) {
          auditLogger.log({
            source: "chat",
            toolName: t.name,
            args: args as Record<string, unknown>,
            result: { message: err instanceof Error ? err.message : String(err) },
            success: false,
            durationMs: Date.now() - start,
          });
          throw err;
        }
      },
    }) as CoreTool;
  }

  return aiTools;
}
