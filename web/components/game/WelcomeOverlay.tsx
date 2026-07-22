"use client";

/**
 * WelcomeOverlay (P9) — first-visit primer.
 *
 * Shows once per device (localStorage gate). Lists the 4 things a new
 * student needs to know to start exploring: move, look, interact, view
 * full controls. Dismissible via button or Esc.
 */

import { useEffect, useState } from "react";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";

const STORAGE_KEY = "tsi.welcome.v1.seen";

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);
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
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR-safe init; localStorage isn't available server-side
        setVisible(true);
      }
    } catch {
      /* ignore — private browsing etc. */
    }
  }, []);

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
        zIndex: 70,
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
          borderRadius: "14px",
          padding: "28px 30px",
          color: "#f1ffff",
          boxShadow: "0 18px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#FFD166",
            letterSpacing: "0.18em",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          Welcome to Tethos
        </div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", lineHeight: 1.25 }}>
          Look around, talk to people, find your village.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
          {coarse ? (
            <>
              <Row keys={["Tap ground"]} label="Walk there" />
              <Row keys={["Drag"]} label="Look around" />
              <Row keys={["Tap NPC"]} label="Chat with anyone" />
              <Row keys={["Emote button"]} label="Wave, dance, laugh" />
            </>
          ) : (
            <>
              <Row keys={["W", "A", "S", "D"]} label="Walk (camera-relative)" />
              <Row keys={["Right-click", "drag"]} label="Look around" />
              <Row keys={["E"]} label="Interact when you see a prompt" />
              <Row keys={["Click NPC"]} label="Chat with anyone" />
              <Row keys={["F1"]} label="Full controls list, anytime" />
            </>
          )}
        </div>

        <button
          onClick={dismiss}
          style={{
            width: "100%",
            background: "linear-gradient(180deg, #FFD166, #E8A93C)",
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
          <div style={{ marginTop: "10px", textAlign: "center", fontSize: "11px", color: "#8a939a" }}>
            Press Enter or Esc to dismiss
          </div>
        )}
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
        borderRadius: "6px",
        fontSize: "13px",
      }}
    >
      <div style={{ display: "flex", gap: "4px" }}>
        {keys.map((k, i) => (
          <span
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
          </span>
        ))}
      </div>
      <div style={{ color: "#c9d1d6", textAlign: "right", marginLeft: "16px" }}>{label}</div>
    </div>
  );
}
