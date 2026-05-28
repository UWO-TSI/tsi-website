"use client";

import { useEffect } from "react";
import { useEmoteTypes } from "@/lib/game/contentLoader";
import type { EmoteType } from "@/lib/game/contentTypes";

/**
 * EmoteMenu (sprint E2) — DOM overlay rendered alongside AudioController /
 * NPCChatOverlay, outside the R3F Canvas. Opens on E key or sidebar icon
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

export default function EmoteMenu({ open, onClose, onPick }: EmoteMenuProps) {
  const { data: emotes } = useEmoteTypes();

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

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

      {/* Menu — bottom-center row */}
      <div
        role="dialog"
        aria-label="Emote menu"
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "rgba(15, 15, 16, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 14,
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          animation: "emoteMenuPopIn 200ms ease-out",
        }}
      >
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
              width: 64,
              height: 64,
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
                color: "#9ca3af",
                textTransform: "uppercase",
              }}
            >
              {emote.display_name}
            </span>
          </button>
        ))}
      </div>

      <style jsx>{`
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
  if (emote.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emote.icon_url}
        alt={emote.display_name}
        width={28}
        height={28}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }
  const emoji = EMOJI_BY_KEY[emote.animation_key];
  if (emoji) {
    return <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>;
  }
  return (
    <span
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
