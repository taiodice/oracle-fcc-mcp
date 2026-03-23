/**
 * Auto-update handler using electron-updater.
 *
 * Flow:
 *   1. App starts → check for update after 5s grace period
 *   2. Update found → push `update:available` event to renderer
 *   3. User clicks Download → `update:download` IPC → start download
 *   4. Download progress → push `update:progress` events to renderer
 *   5. Download complete → push `update:ready` event to renderer
 *   6. User clicks Restart → `update:install` IPC → quitAndInstall()
 *
 * Code signing:
 *   Set env vars before running `npm run build:brand`:
 *     WIN_CSC_LINK=path/to/certificate.pfx
 *     WIN_CSC_KEY_PASSWORD=your-pfx-password
 *   Or for cloud signing, configure in electron-builder.yml.
 */

import { ipcMain, BrowserWindow } from "electron";
// electron-updater is CommonJS — must use default import in ESM context
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;
import type { ProgressInfo } from "electron-updater";

export function setupUpdateHandler(getMainWindow: () => BrowserWindow | null) {
  // Disable auto-download so we can show the user a prompt first
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // In dev mode, skip update checks entirely
  if (process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.forceDevUpdateConfig = false;
    return;
  }

  // ── Event → Renderer bridge ──────────────────────────────────────────────

  function send(channel: string, payload?: unknown) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }

  autoUpdater.on("update-available", (info) => {
    send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-not-available", () => {
    send("update:not-available");
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    send("update:progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("update:ready", { version: info.version });
  });

  autoUpdater.on("error", (err: Error) => {
    // Log but don't crash — update errors should never block the app
    console.error("[updater] Error:", err.message);
    send("update:error", err.message);
  });

  // ── IPC from Renderer ────────────────────────────────────────────────────

  // Manual update check (e.g. user clicks "Check for updates" in settings)
  ipcMain.handle("update:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo ?? null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Start downloading after user acknowledges the available update
  ipcMain.handle("update:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Quit the app and install the downloaded update
  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
  });

  // ── Initial check on startup (delayed to not block UI load) ─────────────

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("[updater] Startup check failed:", err.message);
    });
  }, 5_000);
}
