"use client";

/**
 * GraphicsSettings panel (G4+G5 follow-up).
 *
 * In-game popup with 4 graphics toggles. DOM overlay (NOT inside Canvas).
 * Driven by useGraphicsSettings().
 */

import { useEffect } from "react";
import { Settings } from "lucide-react";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";

interface GraphicsSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function GraphicsSettingsPanel({ open, onClose }: GraphicsSettingsProps) {
  const [settings, actions] = useGraphicsSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        zIndex: 60,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          background: "rgba(15, 15, 16, 0.96)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "8px",
          padding: "20px 24px",
          color: "#f1ffff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em" }}>GRAPHICS</div>
          <button
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

        <Toggle
          label="Lite mode"
          hint="Disables particles, clouds, ghosts. Best for low-end devices."
          value={settings.liteMode}
          onChange={actions.setLiteMode}
        />
        <Toggle
          label="Bloom glow"
          hint="Soft glow on lanterns / braziers / fireflies. Costs ~12 FPS."
          value={settings.bloom}
          onChange={actions.setBloom}
          disabled={settings.liteMode}
        />
        <Toggle
          label="Shadows"
          hint="Dynamic sun shadows. Costs ~7 FPS on M1."
          value={settings.shadows}
          onChange={actions.setShadows}
          disabled={settings.liteMode}
        />
        <Toggle
          label="Ghost replay"
          hint="Faded outlines of members who were here recently."
          value={settings.ghostsEnabled}
          onChange={actions.setGhostsEnabled}
          disabled={settings.liteMode}
        />

        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "#8a939a" }}>Settings persist on this device.</span>
          <button
            onClick={actions.resetToAuto}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#8a939a",
              borderRadius: "4px",
              padding: "3px 10px",
              fontSize: "10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Auto-detect
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label, hint, value, onChange, disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ flex: 1, paddingRight: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "10px", color: "#8a939a", marginTop: "2px" }}>{hint}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        aria-pressed={value}
        style={{
          background: value ? "#1D9BF0" : "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "12px",
          width: "44px",
          height: "22px",
          padding: 0,
          position: "relative",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: value ? "24px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#f1ffff",
            transition: "left 0.15s",
          }}
        />
      </button>
    </div>
  );
}

export function GraphicsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open graphics settings"
      title="Graphics"
      style={{
        position: "absolute",
        bottom: 16,
        right: 280,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        background: "rgba(15, 15, 16, 0.78)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 8,
        color: "#f1ffff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        cursor: "pointer",
        backdropFilter: "blur(6px)",
      }}
    >
      <Settings size={14} />
      Graphics
    </button>
  );
}
