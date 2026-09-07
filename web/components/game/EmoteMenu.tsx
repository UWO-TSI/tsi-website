"use client";

import { useState } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { useEmoteTypes } from "@/lib/content/loader";
import type { EmoteType } from "@/lib/content/types";

/**
 * EmoteMenu (sprint E2) — DOM overlay rendered alongside AudioController /
 * NPCChatOverlay, outside the R3F Canvas. Opens on G key or sidebar icon
 * (wired in GameWorld). Click an emote → onPick(emote) → onClose().
 *
 * Cosmetic-only: emotes don't grant XP/TC (CLAUDE.md principle #3 + #4).
 */

const EMOJI_BY_KEY: Record<string, string> = {
  wave: "👋",
  dance: "🕺",
  laugh: "😂",
  point: "👉",
  sit: "🪑",
};

interface EmoteMenuProps {
  open: boolean;
  onClose: () => void;
  onPick: (emote: EmoteType) => void;
}

export default function EmoteMenu(props: EmoteMenuProps) {
  const { data: emotes } = useEmoteTypes();
  return <EmoteMenuView {...props} emotes={emotes} />;
}

export function EmoteMenuView({ open, onClose, onPick, emotes }: EmoteMenuProps & { emotes: EmoteType[] }) {
  const dialogRef = useWorldDialog(open, onClose, "g");

  if (!open) return null;

  const visible = emotes.slice(0, 8);

  return (
    <>
      {/* Backdrop — click closes */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 55,
          background: "rgba(0, 0, 0, 0.25)",
          opacity: 1,
          animation: "emoteMenuFadeIn 200ms ease-out",
        }}
      />

      {/* Menu stays within the world container, including phones opting into 3D. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Emote menu"
        tabIndex={-1}
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          width: Math.min(620, Math.max(260, visible.length * 74 + 28)),
          maxWidth: "calc(100% - 24px)",
          maxHeight: "calc(100% - 110px)",
          overflowY: "auto",
          padding: "12px 14px",
          background: "rgba(15, 15, 16, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 14,
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          animation: "emoteMenuPopIn 200ms ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <span style={{ color: "#f1ffff", fontFamily: "monospace", fontSize: 13 }}>Emotes</span>
          <button aria-label="Close emotes" onClick={onClose} style={{ minWidth: 44, minHeight: 44, border: "1px solid #53616a", borderRadius: 8, color: "#d6e0e5", fontFamily: "monospace", fontSize: 11 }}>ESC</button>
        </div>
        {visible.length === 0 && <p role="status" style={{ color: "#A9B8C4", fontSize: 13, padding: "8px 0" }}>No emotes are available right now.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))", gap: 10 }}>
        {visible.map((emote) => (
          <button
            key={emote.id}
            onClick={() => {
              onPick(emote);
              onClose();
            }}
            aria-label={emote.display_name}
            title={emote.display_name}
            style={{
              width: "100%",
              minHeight: 72,
              padding: "8px 4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 10,
              cursor: "pointer",
              color: "#f1ffff",
              fontFamily: "'IBM Plex Mono', monospace",
              transition: "transform 120ms ease, background 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.14)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <EmoteIcon emote={emote} />
            <span
              style={{
                fontSize: 9,
                letterSpacing: 0.5,
                color: "#B7C4CD",
                overflowWrap: "anywhere",
                textTransform: "uppercase",
              }}
            >
              {emote.display_name}
            </span>
          </button>
        ))}
        </div>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          div { animation: none !important; }
          button { transition: none !important; }
        }
        @keyframes emoteMenuFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes emoteMenuPopIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

function EmoteIcon({ emote }: { emote: EmoteType }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (emote.icon_url && failedSource !== emote.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emote.icon_url}
        alt=""
        onError={() => setFailedSource(emote.icon_url)}
        width={28}
        height={28}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }
  const emoji = EMOJI_BY_KEY[emote.animation_key];
  if (emoji) {
    return <span aria-hidden style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>;
  }
  return (
    <span
      aria-hidden
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        background: "rgba(126, 200, 80, 0.25)",
        color: "#9ADE6B",
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {emote.display_name.charAt(0).toUpperCase()}
    </span>
  );
}
