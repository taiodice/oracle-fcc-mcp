import React, { useEffect, useState } from "react";

type UpdateState =
  | { phase: "idle" }
  | { phase: "available"; version: string; releaseDate: string }
  | { phase: "downloading"; percent: number; bytesPerSecond: number }
  | { phase: "ready"; version: string }
  | { phase: "error"; message: string };

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.fccCommander) return;

    const unsubAvailable = window.fccCommander.onUpdateAvailable((info) => {
      setState({ phase: "available", version: info.version, releaseDate: info.releaseDate });
      setDismissed(false);
    });

    const unsubProgress = window.fccCommander.onUpdateProgress((progress) => {
      setState({ phase: "downloading", percent: progress.percent, bytesPerSecond: progress.bytesPerSecond });
    });

    const unsubReady = window.fccCommander.onUpdateReady((info) => {
      setState({ phase: "ready", version: info.version });
    });

    const unsubError = window.fccCommander.onUpdateError((error) => {
      setState({ phase: "error", message: error });
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubReady();
      unsubError();
    };
  }, []);

  async function handleDownload() {
    if (!window.fccCommander) return;
    setState((s) => s.phase === "available" ? { phase: "downloading", percent: 0, bytesPerSecond: 0 } : s);
    await window.fccCommander.downloadUpdate();
  }

  function handleInstall() {
    window.fccCommander?.installUpdate();
  }

  if (dismissed || state.phase === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 animate-slide-up">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(13,27,46,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(21,101,192,0.2)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ background: "linear-gradient(135deg, #1565C0, #00BCD4)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span className="text-white text-sm">↑</span>
          <span className="text-white text-xs font-semibold flex-1">Software Update</span>
          {state.phase !== "downloading" && (
            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white text-xs transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="px-4 py-3">
          {state.phase === "available" && (
            <>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#E2EBF5" }}>
                Version {state.version} available
              </p>
              <p className="text-xs mb-3" style={{ color: "#7096B8" }}>
                Released {new Date(state.releaseDate).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)", boxShadow: "0 4px 12px rgba(21,101,192,0.3)" }}
                >
                  Download Update
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#B4CCE5", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  Later
                </button>
              </div>
            </>
          )}

          {state.phase === "downloading" && (
            <>
              <p className="text-sm font-semibold mb-1" style={{ color: "#E2EBF5" }}>Downloading update…</p>
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${state.percent}%`, background: "linear-gradient(90deg, #1565C0, #00BCD4)" }}
                />
              </div>
              <p className="text-[10px] font-data" style={{ color: "#7096B8" }}>
                {state.percent}% · {formatSpeed(state.bytesPerSecond)}
              </p>
            </>
          )}

          {state.phase === "ready" && (
            <>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#E2EBF5" }}>
                Update ready to install
              </p>
              <p className="text-xs mb-3" style={{ color: "#7096B8" }}>
                Version {state.version} will be installed on restart.
              </p>
              <button
                onClick={handleInstall}
                className="w-full py-1.5 text-xs font-semibold rounded-lg text-white transition-all"
                style={{ background: "linear-gradient(135deg, #00BCD4, #00C9A7)", boxShadow: "0 4px 12px rgba(0,188,212,0.3)" }}
              >
                Restart & Install
              </button>
            </>
          )}

          {state.phase === "error" && (
            <>
              <p className="text-sm font-semibold mb-1" style={{ color: "#FF5252" }}>Update failed</p>
              <p className="text-xs truncate" style={{ color: "#7096B8" }}>{state.message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}
