/**
 * Audit IPC Handlers — Query, export, and manage audit trail
 */

import type { IpcMain } from "electron";
import { dialog, shell } from "electron";
import fs from "fs";
import path from "path";
import { auditLogger, AuditQuery, AuditEntry } from "./audit-logger.js";

export function setupAuditHandlers(ipcMain: IpcMain) {
  // Query audit log with filters
  ipcMain.handle("audit:query", (_event, query: AuditQuery) => {
    return auditLogger.query(query);
  });

  // Get audit stats
  ipcMain.handle("audit:stats", () => {
    return auditLogger.getStats();
  });

  // Clear audit log
  ipcMain.handle("audit:clear", () => {
    auditLogger.clear();
    return { success: true };
  });

  // Export to Excel-compatible CSV (opens save dialog)
  ipcMain.handle("audit:export", async (_event, query: AuditQuery) => {
    const entries = auditLogger.getAllEntries(query);
    if (entries.length === 0) {
      return { success: false, message: "No entries to export." };
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Audit Trail",
      defaultPath: `FCC-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [
        { name: "CSV (Excel-compatible)", extensions: ["csv"] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, message: "Export cancelled." };
    }

    try {
      const csv = entriesToCsv(entries);
      // Write with BOM for Excel UTF-8 compatibility
      fs.writeFileSync(filePath, "\uFEFF" + csv, "utf8");
      shell.showItemInFolder(filePath);
      return { success: true, message: `Exported ${entries.length} entries to ${path.basename(filePath)}` };
    } catch (err) {
      return { success: false, message: `Export failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

function entriesToCsv(entries: AuditEntry[]): string {
  const headers = [
    "Timestamp",
    "Category",
    "Tool",
    "Source",
    "Success",
    "Duration (ms)",
    "Arguments",
    "Result Summary",
    "Tenant",
    "User",
  ];

  const rows = entries.map((e) => [
    e.timestamp,
    e.category,
    e.toolName,
    e.source,
    e.success ? "Yes" : "No",
    String(e.durationMs),
    JSON.stringify(e.args).replace(/"/g, '""'),
    (e.resultSummary || "").replace(/"/g, '""'),
    e.tenant || "",
    e.user || "",
  ]);

  const escape = (val: string) => `"${val}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  return lines.join("\r\n");
}
