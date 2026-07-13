"use client";

/**
 * ToastHub (game-feel wave G3, item 11) — ONE toast system for the whole
 * game. Fruit, flowers, fish, filler chatter all funnel through here:
 * consistent pill, consistent position (bottom-center above the hotbar),
 * consistent soft slide+fade, queued to three.
 *
 * Fire from anywhere: `toast("You picked a white lily!")` — it's a window
 * event under the hood, so world-layer components (inside the Canvas) and
 * DOM components use the same call.
 */

import { useEffect, useState } from "react";

export function toast(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text } }));
}

interface Entry {
  id: number;
  text: string;
}

let nextId = 0;
const TOAST_MS = 2600;

export default function ToastHub() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      if (!text) return;
      const id = nextId++;
      setEntries((prev) => [...prev.slice(-2), { id, text }]);
      window.setTimeout(() => {
        setEntries((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_MS);
    };
    window.addEventListener("tsi:toast", onToast);
    return () => window.removeEventListener("tsi:toast", onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute",
        bottom: 96, // clears the ToolDock (item 12) pill below
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 65,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {entries.map((t) => (
        <div
          key={t.id}
          style={{
            background: "rgba(255, 252, 240, 0.95)",
            color: "#3D3A2E",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 999,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
            animation: `tsi-toast-in 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.2), tsi-toast-out 0.3s ease-in ${TOAST_MS - 320}ms forwards`,
          }}
        >
          {t.text}
          <style>{`
            @keyframes tsi-toast-in { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }
            @keyframes tsi-toast-out { to { opacity: 0; transform: translateY(-6px); } }
          `}</style>
        </div>
      ))}
    </div>
  );
}
