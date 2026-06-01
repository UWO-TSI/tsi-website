"use client";

/**
 * Crosshair (sprint F1.2) — subtle center-screen indicator that fades in
 * when an interactable is within range, fades out otherwise. DOM overlay
 * (NOT inside R3F Canvas). Driven by GameWorld's interactable-distance
 * check (passed via `active` prop).
 */

interface CrosshairProps {
  active: boolean;
  /** Optional label to show under the crosshair (e.g. NPC name, "Enter Shop"). */
  hint?: string | null;
}

export default function Crosshair({ active, hint }: CrosshairProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        opacity: active ? 1 : 0.35,
        transition: "opacity 0.2s ease",
        zIndex: 20,
        fontFamily: "'IBM Plex Mono', monospace",
        textAlign: "center",
      }}
    >
      {/* Plus-shape crosshair */}
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: "block", margin: "0 auto" }}>
        <line
          x1="10" y1="3" x2="10" y2="8"
          stroke={active ? "#FFD166" : "#ffffff"}
          strokeWidth="1.5"
          opacity={active ? 0.95 : 0.55}
        />
        <line
          x1="10" y1="12" x2="10" y2="17"
          stroke={active ? "#FFD166" : "#ffffff"}
          strokeWidth="1.5"
          opacity={active ? 0.95 : 0.55}
        />
        <line
          x1="3" y1="10" x2="8" y2="10"
          stroke={active ? "#FFD166" : "#ffffff"}
          strokeWidth="1.5"
          opacity={active ? 0.95 : 0.55}
        />
        <line
          x1="12" y1="10" x2="17" y2="10"
          stroke={active ? "#FFD166" : "#ffffff"}
          strokeWidth="1.5"
          opacity={active ? 0.95 : 0.55}
        />
        <circle
          cx="10" cy="10" r="1.2"
          fill={active ? "#FFD166" : "#ffffff"}
          opacity={active ? 1 : 0.7}
        />
      </svg>

      {active && hint && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "11px",
            color: "#f1ffff",
            background: "rgba(15, 15, 16, 0.7)",
            padding: "2px 8px",
            borderRadius: "4px",
            border: "1px solid rgba(255, 209, 102, 0.4)",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          <span style={{ color: "#FFD166", marginRight: 6 }}>E</span>
          {hint}
        </div>
      )}
    </div>
  );
}
