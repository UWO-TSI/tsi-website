"use client";

/**
 * ApplyWelcomeOverlay — the applicant island's first-visit primer (a fork
 * of WelcomeOverlay with its own storage key and copy). Tells the parent
 * while it is up so the world can freeze input.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "tsi.apply.welcome.v1.seen";

export default function ApplyWelcomeOverlay({
  onVisibility,
  forceShow,
}: {
  onVisibility: (visible: boolean) => void;
  /** Bump to re-open the primer (the Keys button). */
  forceShow?: number;
}) {
  const [visible, setVisible] = useState(false);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR-safe init; localStorage isn't available server-side
        setVisible(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (forceShow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external re-open signal
      setVisible(true);
    }
  }, [forceShow]);

  useEffect(() => {
    onVisibility(visible);
  }, [visible, onVisibility]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 75,
        fontFamily: "'IBM Plex Mono', monospace",
        animation: "tsi-welcome-fade-in 240ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 92vw)",
          background: "linear-gradient(160deg, rgba(20,22,30,0.97), rgba(15,15,16,0.97))",
          border: "1px solid rgba(255,212,128,0.35)",
          borderRadius: 14,
          padding: "28px 30px",
          color: "#f1ffff",
          boxShadow: "0 18px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ fontSize: 11, color: "#FFD166", letterSpacing: "0.18em", marginBottom: 8, textTransform: "uppercase" }}>
          Tethos application portal
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, lineHeight: 1.25 }}>
          Follow the arrows up the road to HQ. The recruiters are inside.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          <Row keys={["W", "A", "S", "D"]} label="Walk" />
          <Row keys={["Right-click", "drag"]} label="Look around" />
          <Row keys={["E"]} label="Enter HQ, talk to a recruiter" />
          <Row keys={["Esc"]} label="Close a window" />
        </div>

        <button
          onClick={dismiss}
          style={{
            width: "100%",
            background: "linear-gradient(180deg, #FFD166, #E8A93C)",
            color: "#1A1410",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(255,209,102,0.25)",
          }}
        >
          Start walking
        </button>
        <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: "#8a939a" }}>
          Press Enter or Esc to dismiss
        </div>
      </div>

      <style jsx>{`
        @keyframes tsi-welcome-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {keys.map((k, i) => (
          <span
            key={i}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              minWidth: 20,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {k}
          </span>
        ))}
      </div>
      <div style={{ color: "#c9d1d6", textAlign: "right", marginLeft: 16 }}>{label}</div>
    </div>
  );
}
