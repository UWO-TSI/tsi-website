"use client";

/**
 * ToolDock (game-feel item 12, 2026-07-12) — the bottom-center toolbelt.
 *
 * Replaces the four buttons that had accreted along the bottom-right edge
 * (Emote / Guestbook / Collection / Graphics) with one ACNH-style dock:
 * square icon slots in a glass pill, hotkey chips on the slots that have
 * key bindings, labels revealed under the icon. Pure DOM — GameWorld owns
 * all the open/close state and passes click handlers in; the dock renders
 * whatever it's given, so future tools (fishing rod, net…) are one array
 * entry each.
 */

import { type ReactNode } from "react";

export interface DockItem {
  id: string;
  icon: ReactNode;
  label: string;
  hotkey?: string;
  onClick: () => void;
}

export default function ToolDock({ items }: { items: DockItem[] }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        gap: 4,
        padding: "6px 8px",
        background: "rgba(15, 15, 16, 0.78)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 16,
        backdropFilter: "blur(6px)",
      }}
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={it.onClick}
          aria-label={it.label}
          title={it.hotkey ? `${it.label} (${it.hotkey})` : it.label}
          className="tsi-dock-slot"
          style={{
            position: "relative",
            width: 52,
            height: 52,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 11,
            color: "#f1ffff",
            fontFamily: "'IBM Plex Mono', monospace",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", fontSize: 17, lineHeight: 1 }}>{it.icon}</span>
          <span style={{ fontSize: 8.5, letterSpacing: "0.02em", opacity: 0.85 }}>{it.label}</span>
          {it.hotkey && (
            <span
              style={{
                position: "absolute",
                top: 3,
                right: 4,
                fontSize: 8,
                padding: "0px 3px",
                borderRadius: 3,
                background: "rgba(255, 221, 135, 0.16)",
                border: "1px solid rgba(255, 221, 135, 0.35)",
                color: "#FFDD87",
                lineHeight: "10px",
              }}
            >
              {it.hotkey}
            </span>
          )}
        </button>
      ))}
      <style>{`
        .tsi-dock-slot { transition: transform 0.14s ease, background 0.14s ease; }
        .tsi-dock-slot:hover { transform: translateY(-3px); background: rgba(255, 255, 255, 0.12) !important; }
        .tsi-dock-slot:active { transform: translateY(-1px) scale(0.97); }
      `}</style>
    </div>
  );
}
