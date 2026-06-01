"use client";

/**
 * ControlsOverlay (sprint F1.5) — modal listing current keybindings.
 *
 * Opens via F1 key (handled in GameWorld). Closes with F1 again or ESC.
 * Pure DOM (NOT inside R3F Canvas). Updated when new bindings ship —
 * single source of truth for what's currently bound in-game.
 */

import { useEffect } from "react";

interface ControlsOverlayProps {
  visible: boolean;
  onClose: () => void;
}

interface Binding {
  keys: string[];
  label: string;
}

interface Section {
  title: string;
  bindings: Binding[];
}

const SECTIONS: Section[] = [
  {
    title: "Movement",
    bindings: [
      { keys: ["W"], label: "Forward (camera-relative)" },
      { keys: ["A"], label: "Strafe left" },
      { keys: ["S"], label: "Backward" },
      { keys: ["D"], label: "Strafe right" },
      { keys: ["Shift"], label: "Sprint (hold)" },
      { keys: ["Space"], label: "Jump (cosmetic)" },
      { keys: ["Click"], label: "Walk to point (alternative)" },
    ],
  },
  {
    title: "Camera",
    bindings: [
      { keys: ["Right-click", "drag"], label: "Rotate camera" },
      { keys: ["←", "→"], label: "Yaw (left / right)" },
      { keys: ["↑", "↓"], label: "Pitch (look up / down, limited)" },
      { keys: ["Scroll"], label: "Zoom in / out" },
    ],
  },
  {
    title: "Interact",
    bindings: [
      { keys: ["E"], label: "Interact with nearest NPC / enter building" },
      { keys: ["G"], label: "Open emote menu" },
      { keys: ["Tab", "hold"], label: "Show who's online" },
      { keys: ["Click NPC"], label: "Chat with NPC (alternative)" },
    ],
  },
  {
    title: "UI",
    bindings: [
      { keys: ["F1"], label: "This controls overlay" },
      { keys: ["Esc"], label: "Close overlay / cancel" },
    ],
  },
];

export default function ControlsOverlay({ visible, onClose }: ControlsOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "F1") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        zIndex: 60,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "rgba(15, 15, 16, 0.96)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "10px",
          padding: "20px 24px",
          color: "#f1ffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.05em" }}>CONTROLS</div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#8a939a",
              borderRadius: "4px",
              padding: "2px 10px",
              fontSize: "11px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ESC
          </button>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: "18px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#8a939a",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: "4px",
              }}
            >
              {section.title}
            </div>
            {section.bindings.map((b, i) => (
              <div
                key={`${section.title}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  {b.keys.map((k, j) => (
                    <Kbd key={j} text={k} />
                  ))}
                </div>
                <div style={{ color: "#c9d1d6", textAlign: "right", marginLeft: "16px" }}>{b.label}</div>
              </div>
            ))}
          </div>
        ))}

        <div
          style={{
            marginTop: "8px",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: "11px",
            color: "#8a939a",
          }}
        >
          Press <Kbd text="F1" /> or <Kbd text="Esc" /> to close. New bindings coming in upcoming sprints.
        </div>
      </div>
    </div>
  );
}

function Kbd({ text }: { text: string }) {
  return (
    <span
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "4px",
        padding: "2px 7px",
        fontSize: "11px",
        fontFamily: "inherit",
        color: "#f1ffff",
        minWidth: "20px",
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
