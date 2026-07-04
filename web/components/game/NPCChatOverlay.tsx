"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Flag, Loader2, Send } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";
import type { NPCPersona } from "@/lib/game/contentTypes";

/**
 * NPCChatOverlay (sprint D4) — DOM overlay rendered alongside AudioController,
 * outside the R3F Canvas. Opens when GameWorld sets `npc` to a persona. The
 * sprite click handler that fires this lives in D5.
 *
 * Talks to:
 *   - POST /api/npc/chat                          (D3)
 *   - GET  /api/npc/conversations?npc_id=&limit=  (this sprint)
 *   - POST /api/npc/conversations/[id]/flag       (this sprint)
 */

const TYPE_INTERVAL_MS = 30;
const HISTORY_LIMIT = 10;

interface NPCChatOverlayProps {
  npc: NPCPersona | null;
  onClose: () => void;
}

type Turn = {
  id: string;
  user_message: string;
  npc_response: string;
  flagged: boolean;
  created_at: string;
  // Local-only: if true, render the NPC response with the typewriter effect.
  isFresh?: boolean;
};

export default function NPCChatOverlay({ npc, onClose }: NPCChatOverlayProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load history on open ────────────────────────────────────────
  useEffect(() => {
    if (!npc) return;
    let cancelled = false;
    setTurns([]);
    setErrorMsg(null);
    setRetryPayload(null);
    setInput("");

    (async () => {
      try {
        const res = await fetch(
          `/api/npc/conversations?npc_id=${encodeURIComponent(npc.id)}&limit=${HISTORY_LIMIT}`,
        );
        if (cancelled) return;
        if (res.status === 401) {
          setErrorMsg("Please sign in to chat");
          setTimeout(() => !cancelled && onClose(), 3000);
          return;
        }
        if (!res.ok) {
          // Endpoint may not exist or DB unreachable — start empty.
          // TODO: wire history persistence if this ever ships before route.
          return;
        }
        const data = (await res.json()) as { turns?: Turn[] };
        if (Array.isArray(data.turns)) setTurns(data.turns);
      } catch {
        // Network error on history load is non-fatal — start empty.
      }
    })();

    // Focus input shortly after mount.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      cancelled = true;
      clearTimeout(focusTimer);
    };
  }, [npc, onClose]);

  // ── ESC closes ──────────────────────────────────────────────────
  useEffect(() => {
    if (!npc) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [npc, onClose]);

  // ── Auto-scroll on new content ─────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, sending]);

  // ── Auto-clear toast ────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!npc) return;
      const message = text.trim();
      if (!message || sending) return;

      setSending(true);
      setErrorMsg(null);
      setRetryPayload(null);
      setInput("");

      try {
        const res = await fetch("/api/npc/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ npc_id: npc.id, message }),
        });

        if (res.status === 401) {
          setErrorMsg("Please sign in to chat");
          setTimeout(() => onClose(), 3000);
          return;
        }
        if (res.status === 404) {
          onClose();
          return;
        }
        if (res.status === 429) {
          setErrorMsg(
            "You're sending messages too fast. Try again in a few minutes.",
          );
          return;
        }
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setErrorMsg(body.error ?? "Please keep messages respectful.");
          return;
        }
        if (!res.ok) {
          setErrorMsg("Couldn't reach the server. Try again.");
          setRetryPayload(message);
          return;
        }

        const data = (await res.json()) as { reply?: string };
        const reply = data.reply ?? "";
        setTurns((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            user_message: message,
            npc_response: reply,
            flagged: false,
            created_at: new Date().toISOString(),
            isFresh: true,
          },
        ]);
      } catch {
        setErrorMsg("Couldn't reach the server. Try again.");
        setRetryPayload(message);
      } finally {
        setSending(false);
      }
    },
    [npc, sending, onClose],
  );

  const handleFlag = useCallback(async (turnId: string) => {
    // Local turns (just-sent, no DB id yet) can't be flagged this round.
    if (turnId.startsWith("local-")) {
      setToast("This message can be reported after refresh.");
      return;
    }
    try {
      const res = await fetch(`/api/npc/conversations/${turnId}/flag`, {
        method: "POST",
      });
      if (res.ok) {
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, flagged: true } : t)),
        );
        setToast("Reported");
      } else {
        setToast("Couldn't report message");
      }
    } catch {
      setToast("Couldn't report message");
    }
  }, []);

  if (!npc) return null;

  const visible = npc !== null;

  return (
    <>
      {/* Backdrop — click closes */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={`Chat with ${npc.display_name}`}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(600px, 92vw)",
          maxHeight: "82vh",
          background: "#0d1b2a",
          border: "1px solid rgba(0, 47, 167, 0.3)",
          borderRadius: 16,
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.6)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: "#f1ffff",
          fontFamily: "'IBM Plex Mono', monospace",
          animation: "npcChatIn 200ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: 10,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close chat"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9ca3af",
              padding: 4,
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {npc.display_name}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(126, 200, 80, 0.18)",
                color: "#9ADE6B",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {npc.spawn_zone}
            </span>
          </div>
        </div>

        {/* Portrait */}
        <NPCPortrait npc={npc} />

        {/* Conversation */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 160,
            maxHeight: "40vh",
            overflowY: "auto",
            padding: "8px 4px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            ─── Conversation ───
          </div>
          {turns.length === 0 && !sending && (
            <div
              style={{
                color: "#6b7280",
                fontStyle: "italic",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              Say hi to start chatting.
            </div>
          )}
          {turns.map((turn) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              npcName={npc.display_name}
              onFlag={() => handleFlag(turn.id)}
            />
          ))}
          {sending && (
            <div style={{ color: "#9ca3af", fontStyle: "italic" }}>
              <span>{npc.display_name} is thinking</span>
              <span className="npc-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          )}
        </div>

        {/* Error / retry */}
        {errorMsg && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(232, 80, 80, 0.12)",
              border: "1px solid rgba(232, 80, 80, 0.4)",
              borderRadius: 8,
              color: "#FFB4B4",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>{errorMsg}</span>
            {retryPayload && (
              <button
                onClick={() => sendMessage(retryPayload)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#f1ffff",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Input row */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={sending}
            placeholder="Type your message..."
            rows={2}
            style={{
              flex: 1,
              resize: "none",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 10px",
              color: "#f1ffff",
              fontFamily: "inherit",
              fontSize: 13,
              outline: "none",
              opacity: sending ? 0.6 : 1,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={sending || input.trim().length === 0}
            aria-label="Send"
            style={{
              background:
                sending || input.trim().length === 0 ? "#1f2a3a" : "#002FA7",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#f1ffff",
              cursor:
                sending || input.trim().length === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {sending ? (
              <Loader2 size={14} className="npc-spin" />
            ) : (
              <Send size={14} />
            )}
            Send
          </button>
        </div>

        {toast && (
          <div
            style={{
              position: "absolute",
              bottom: -36,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15,15,16,0.92)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 11,
              color: "#f1ffff",
              whiteSpace: "nowrap",
            }}
          >
            {toast}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes npcChatIn {
          from {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        :global(.npc-dots span) {
          display: inline-block;
          animation: npcDot 1.2s infinite ease-in-out;
        }
        :global(.npc-dots span:nth-child(2)) {
          animation-delay: 0.15s;
        }
        :global(.npc-dots span:nth-child(3)) {
          animation-delay: 0.3s;
        }
        @keyframes npcDot {
          0%,
          80%,
          100% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
        }
        :global(.npc-spin) {
          animation: npcSpin 0.9s linear infinite;
        }
        @keyframes npcSpin {
          to {
            transform: rotate(360deg);
          }
        }
        :global(.npc-cursor) {
          display: inline-block;
          margin-left: 2px;
          animation: npcBlink 0.8s steps(2) infinite;
        }
        @keyframes npcBlink {
          0%,
          50% {
            opacity: 1;
          }
          50.01%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

// ─── Portrait — colored quad placeholder, real sprite swap in D5 ─────────────
function NPCPortrait({ npc }: { npc: NPCPersona }) {
  // Derive a stable color from the slug so each NPC has a distinct portrait
  // until real sprites land.
  const hue = hashHue(npc.slug);
  return (
    <div
      style={{
        height: 96,
        borderRadius: 12,
        background: `linear-gradient(135deg, hsl(${hue} 60% 45%), hsl(${(hue + 40) % 360} 50% 30%))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 700,
        letterSpacing: 2,
        fontSize: 18,
        textTransform: "uppercase",
        textShadow: "0 2px 8px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {npc.display_name}
    </div>
  );
}

function hashHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

// ─── Turn block: user message bubble + NPC reply bubble w/ typewriter ────────
function TurnBlock({
  turn,
  npcName,
  onFlag,
}: {
  turn: Turn;
  npcName: string;
  onFlag: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* User bubble */}
      <div
        style={{
          alignSelf: "flex-end",
          maxWidth: "82%",
          background: "rgba(0, 47, 167, 0.32)",
          border: "1px solid rgba(74, 122, 255, 0.4)",
          borderRadius: "12px 12px 2px 12px",
          padding: "6px 10px",
          color: "#f1ffff",
          whiteSpace: "pre-wrap",
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "#9ca3af",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          You
        </div>
        {turn.user_message}
      </div>

      {/* NPC bubble */}
      <div
        style={{
          alignSelf: "flex-start",
          maxWidth: "88%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px 12px 12px 2px",
          padding: "6px 10px",
          color: "#f1ffff",
          whiteSpace: "pre-wrap",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: "#9ADE6B",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {npcName}
          </span>
          <button
            onClick={onFlag}
            aria-label="Report message"
            title={turn.flagged ? "Reported" : "Report"}
            disabled={turn.flagged}
            style={{
              background: "none",
              border: "none",
              cursor: turn.flagged ? "default" : "pointer",
              color: turn.flagged ? "#E85050" : "#6b7280",
              padding: 2,
              display: "flex",
            }}
          >
            <Flag size={11} />
          </button>
        </div>
        <NPCReplyText text={turn.npc_response} animate={!!turn.isFresh} />
      </div>
    </div>
  );
}

// ─── Typewriter reveal for fresh NPC replies ─────────────────────────────────
function NPCReplyText({ text, animate }: { text: string; animate: boolean }) {
  // When not animating, render the full text directly (no state needed). When
  // animating, advance `count` via an interval. Avoids the cascade-render lint
  // rule that fires on sync setState-in-effect.
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!animate) return;
    let ticks = 0;
    const id = setInterval(() => {
      ticks++;
      // Animalese-lite: a random CC0 voice blip roughly every 4th character
      // while text reveals. Skips whitespace ticks so pauses stay silent;
      // no-ops entirely until the user enables sound.
      if (ticks % 4 === 0) AudioManager.playBlip();
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [text, animate]);

  const shown = animate ? count : text.length;
  const done = shown >= text.length;
  return (
    <span>
      {text.slice(0, shown)}
      {!done && <span className="npc-cursor">_</span>}
    </span>
  );
}
