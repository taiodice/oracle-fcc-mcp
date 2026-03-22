import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import path from "path";
import fs from "fs";

// Simple plugin to copy the CJS preload file to dist-electron
function copyPreload(): Plugin {
  const src = path.resolve(__dirname, "electron/preload.cjs");
  const dest = path.resolve(__dirname, "dist-electron/preload.cjs");
  return {
    name: "copy-preload",
    buildStart() {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    },
    handleHotUpdate({ file }) {
      if (file.endsWith("preload.cjs")) {
        fs.copyFileSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    copyPreload(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron", "electron-store", "electron-updater"],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./core"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
    },
  },
});
