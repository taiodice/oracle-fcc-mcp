// Config IPC handler — persistent settings via electron-store

import type { IpcMain } from "electron";
import { safeStorage } from "electron";
import Store from "electron-store";

const store = new Store({
  name: "fcc-commander-config",
  defaults: {
    llm: {
      provider: "claude",
      model: "claude-sonnet-4-20250514",
    },
    tenants: {},
    ui: {
      sidebarCollapsed: false,
      chatPanelOpen: true,
    },
  },
});

// Separate store for encrypted values (API keys)
const secureStore = new Store({
  name: "fcc-commander-secure",
  defaults: {},
});

/** Read a config value directly (for use in main process startup). */
export function getConfigValue(key: string): unknown {
  return store.get(key);
}

/** Read a secure (encrypted) value directly (for use in main process startup). */
export function getSecureValueDirect(key: string): string | null {
  const stored = secureStore.get(key) as string | undefined;
  if (!stored) return null;
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      return stored;
    }
  }
  return stored;
}

export function setupConfigHandler(ipcMain: IpcMain) {
  // Get config value
  ipcMain.handle("config:get", (_event, key: string) => {
    return store.get(key);
  });

  // Set config value
  ipcMain.handle("config:set", (_event, key: string, value: unknown) => {
    store.set(key, value);
    return { success: true };
  });

  // Delete config value
  ipcMain.handle("config:delete", (_event, key: string) => {
    store.delete(key as any);
    return { success: true };
  });

  // Set encrypted value (for API keys)
  ipcMain.handle("config:setSecure", (_event, key: string, value: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      secureStore.set(key, encrypted.toString("base64"));
    } else {
      // Fallback: store as-is (less secure, but functional)
      secureStore.set(key, value);
    }
    return { success: true };
  });

  // Get encrypted value
  ipcMain.handle("config:getSecure", (_event, key: string) => {
    const stored = secureStore.get(key) as string | undefined;
    if (!stored) return null;

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(stored, "base64");
        return safeStorage.decryptString(buffer);
      } catch {
        return stored; // Fallback for non-encrypted values
      }
    }
    return stored;
  });
}
