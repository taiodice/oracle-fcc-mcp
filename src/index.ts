// Oracle FCC MCP Server — Entry Point

import { loadConfig } from "./config.js";
import { FccClientManager } from "./fcc-client-manager.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  let manager: FccClientManager;

  try {
    const config = loadConfig();
    manager = new FccClientManager(config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Oracle FCC MCP: configuration error — ${message}`);
    manager = new FccClientManager(null, message);
  }

  await startServer(manager);
}

main();
