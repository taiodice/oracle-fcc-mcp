// MCP Server setup — registers all tools and starts stdio transport

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { FccClientManager } from "./fcc-client-manager.js";
import { ToolResult } from "./types.js";

function unconfiguredResult(errorMessage: string): ToolResult {
  return {
    success: false,
    message:
      `Oracle FCC MCP server is not configured. ${errorMessage}\n\n` +
      `Set one of:\n` +
      `  Option A (single tenant):\n` +
      `    FCC_URL=https://your-instance.oraclecloud.com\n` +
      `    FCC_APP_NAME=YourAppName\n` +
      `    FCC_AUTH_METHOD=basic  (or oauth)\n` +
      `    FCC_USERNAME=user@example.com\n` +
      `    FCC_PASSWORD=yourpassword\n\n` +
      `  Option B (multi-tenant):\n` +
      `    FCC_TENANTS_CONFIG=/path/to/tenants.json\n\n` +
      `See README.md for tenants.json format.`,
  };
}
import { registerConnectionTools } from "./tools/connection.js";
import { registerConsolidationTools } from "./tools/consolidation.js";
import { registerDataTools } from "./tools/data.js";
import { registerJournalTools } from "./tools/journals.js";
import { registerOwnershipTools } from "./tools/ownership.js";
import { registerIntercompanyTools } from "./tools/intercompany.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerApprovalTools } from "./tools/approval.js";

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export async function createServer(manager: FccClientManager): Promise<Server> {
  const server = new Server(
    { name: "oracle-fcc-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Tool registry
  const tools: RegisteredTool[] = [];

  function registerTool(
    name: string,
    description: string,
    schema: object,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>
  ): void {
    tools.push({ name, description, inputSchema: schema, handler });
  }

  // Diagnostic tool — always works regardless of config state
  registerTool(
    "fcc_show_config_status",
    "Show the current configuration status of the Oracle FCC MCP server. Use this first if other tools are failing or if you are unsure whether the server is configured correctly.",
    { type: "object", properties: {}, required: [] },
    async () => {
      const err = manager.getConfigError();
      if (err) return unconfiguredResult(err);
      const tenants = manager.listTenants();
      return {
        success: true,
        message: `Server configured with ${tenants.length} tenant(s).`,
        data: { configured: true, tenants, default_tenant: manager.getDefaultTenantName() },
      };
    }
  );

  // Register all tool groups
  registerConnectionTools(manager, registerTool);
  registerConsolidationTools(manager, registerTool);
  registerDataTools(manager, registerTool);
  registerJournalTools(manager, registerTool);
  registerOwnershipTools(manager, registerTool);
  registerIntercompanyTools(manager, registerTool);
  registerMetadataTools(manager, registerTool);
  registerJobTools(manager, registerTool);
  registerApprovalTools(manager, registerTool);

  // ─── List Tools Handler ──────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(
      (t): Tool => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Tool["inputSchema"],
      })
    ),
  }));

  // ─── Call Tool Handler ───────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    if (name !== "fcc_show_config_status") {
      const configErr = manager.getConfigError();
      if (configErr) {
        const result = unconfiguredResult(configErr);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: true,
        };
      }
    }

    try {
      const result = await tool.handler((args as Record<string, unknown>) ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message }) }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startServer(manager: FccClientManager): Promise<void> {
  const server = await createServer(manager);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Oracle FCC MCP server started (stdio transport)");
}
