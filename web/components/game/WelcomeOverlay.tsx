"use client";

/**
 * WelcomeOverlay (P9) — first-visit primer.
 *
 * Shows once per device (localStorage gate). Lists the 4 things a new
 * student needs to know to start exploring: move, look, interact, view
 * full controls. Dismissible via button or Esc.
 */

import { useEffect, useState } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";

const STORAGE_KEY = "tsi.welcome.v1.seen";

export default function WelcomeOverlay({ onVisibleChange }: { onVisibleChange?: (visible: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { onVisibleChange?.(visible); }, [visible, onVisibleChange]);
  // Touch devices that entered full 3D via MobileWorld's "Try full 3D"
  // get touch instructions, not WASD + right-click.
  const coarse = useCoarsePointer();

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY) === "true"; }
    catch { /* Show the primer when storage is unavailable; dismissal still works for this visit. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client preference read
    setVisible(!seen);
  }, []);

  return <WelcomeCard visible={visible} coarse={coarse} onDismiss={dismiss} />;
}

export function WelcomeCard({ visible, coarse, onDismiss }: { visible: boolean; coarse: boolean; onDismiss: () => void }) {
  const dialogRef = useWorldDialog(visible, onDismiss, "Enter");
  if (!visible) return null;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 70,
        fontFamily: "'IBM Plex Mono', monospace",
        animation: "tsi-welcome-fade-in 240ms ease-out",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Tethos"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "calc(100% - 24px)",
          maxHeight: "85dvh",
          overflowY: "auto",
          background: "#152125",
          border: "1px solid rgba(255,212,128,0.35)",
          borderRadius: "14px",
          padding: "24px",
          color: "#f1ffff",
          boxShadow: "0 18px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            fontSize: "11px",
            color: "#FFD166",
            letterSpacing: "0.18em",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          Welcome to Tech for Social Impact
        </div>
        <button onClick={onDismiss} aria-label="Skip introduction" style={{ minWidth: 44, minHeight: 44, color: "#D1DDE1", border: "1px solid #56666b", borderRadius: 8, fontSize: 11 }}>Skip</button>
        </div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", lineHeight: 1.25 }}>
          Look around, talk to people, find your village.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
          {coarse ? (
            <>
              <Row keys={["Tap ground"]} label="Walk there" />
              <Row keys={["Drag"]} label="Look around" />
              <Row keys={["Tap NPC"]} label="Talk to a villager" />
              <Row keys={["Emote button"]} label="Wave, dance, laugh" />
            </>
          ) : (
            <>
              <Row keys={["W", "A", "S", "D"]} label="Walk (camera-relative)" />
              <Row keys={["Right-click", "drag"]} label="Look around" />
              <Row keys={["E"]} label="Interact when you see a prompt" />
              <Row keys={["Click NPC"]} label="Talk to a villager" />
              <Row keys={["F1"]} label="Full controls list, anytime" />
            </>
          )}
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            background: "#FFD166",
            color: "#1A1410",
            border: "none",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(255,209,102,0.25)",
          }}
        >
          Start exploring
        </button>
        {!coarse && (
          <div style={{ marginTop: "10px", textAlign: "center", fontSize: "11px", color: "#A9B8C4" }}>
            Press Enter or Esc to dismiss
          </div>
        )}
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) { div { animation: none !important; } }
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
        flexWrap: "wrap",
        gap: 8,
        padding: "6px 12px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "6px",
        fontSize: "13px",
      }}
    >
      <div style={{ display: "flex", gap: "4px" }}>
        {keys.map((k, i) => (
          <kbd
            key={i}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              minWidth: "20px",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {k}
          </kbd>
        ))}
      </div>
      <div style={{ color: "#c9d1d6", textAlign: "right", flex: "1 1 150px", minWidth: 0 }}>{label}</div>
    </div>
  );
}
