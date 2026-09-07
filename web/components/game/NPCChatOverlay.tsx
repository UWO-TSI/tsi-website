"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Flag, Loader2, Send } from "lucide-react";
import { npcSpriteSources } from "@/lib/game/npcSprites";
import { AudioManager } from "@/lib/game/audio";
import { ChatRequestError, npcChatTransport, type ChatTurn as Turn, type NPCChatTransport } from "@/lib/npc/chatClient";
import type { NPCPersona } from "@/lib/content/types";

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
const MAX_MESSAGE_LENGTH = 500;

interface NPCChatOverlayProps {
  npc: NPCPersona | null;
  onClose: () => void;
  transport?: NPCChatTransport;
}

export default function NPCChatOverlay({ npc, onClose, transport = npcChatTransport }: NPCChatOverlayProps) {
  return npc ? <Conversation key={npc.id} npc={npc} onClose={onClose} transport={transport} /> : null;
}

function Conversation({ npc, onClose, transport }: { npc: NPCPersona; onClose: () => void; transport: NPCChatTransport }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const pendingRef = useRef(false);
  const requestsRef = useRef(new Set<AbortController>());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => () => {
    requestsRef.current.forEach((request) => request.abort());
    requestsRef.current.clear();
  }, []);
  // Loop iter 23 (2026-07-24): while the NPC is "thinking", soft voice
  // blips mutter at a lazy random rhythm — the same voice they answer
  // with, so the wait feels like composing, not buffering.
  useEffect(() => {
    if (!sending) return;
    let alive = true;
    let t = 0;
    const mutter = () => {
      if (!alive) return;
      AudioManager.playBlip();
      t = window.setTimeout(mutter, 550 + Math.random() * 500);
    };
    t = window.setTimeout(mutter, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [sending]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    transport.history(npc.id, controller.signal).then((history) => {
      if (!controller.signal.aborted) setTurns(history);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ChatRequestError && [401, 404].includes(error.status)) {
        setUnavailable(true);
        setHistoryError(error.message);
      } else setHistoryError("Earlier messages couldn't load. You can still start a new message.");
    }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [npc.id, transport]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus({ preventScroll: true });
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); closeRef.current();
      } else if (e.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled), a[href]") ?? []);
        const index = controls.findIndex((control) => control === document.activeElement);
        const next = e.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
        e.preventDefault(); e.stopPropagation(); controls[next]?.focus();
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => {
      window.removeEventListener("keydown", handle, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

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

  const sendMessage = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || pendingRef.current || historyLoading || unavailable) return;
    if (message.length > MAX_MESSAGE_LENGTH) {
      setErrorMsg("Keep your message to 500 characters.");
      return;
    }
    const controller = new AbortController();
    requestsRef.current.add(controller);
    pendingRef.current = true;
    setSending(true);
    setErrorMsg(null);
    setRetryPayload(null);
    inputRef.current?.focus({ preventScroll: true });
    try {
      const reply = await transport.send(npc.id, message, controller.signal);
      if (controller.signal.aborted) return;
      setTurns((previous) => [...previous, {
        id: `local-${Date.now()}`, user_message: message, npc_response: reply,
        flagged: false, created_at: new Date().toISOString(), isFresh: true,
      }]);
      setInput("");
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorMsg(error instanceof ChatRequestError ? error.message : "Couldn't reach the server. Try again.");
      setInput(message);
      if (!(error instanceof ChatRequestError) || error.retryable) setRetryPayload(message);
      if (error instanceof ChatRequestError && [401, 404].includes(error.status)) setUnavailable(true);
    } finally {
      requestsRef.current.delete(controller);
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        setSending(false);
      }
    }
  }, [npc.id, transport, historyLoading, unavailable]);

  const handleFlag = useCallback(async (turnId: string) => {
    if (turnId.startsWith("local-")) {
      setToast("This message can be reported after reopening the conversation.");
      return;
    }
    const controller = new AbortController();
    requestsRef.current.add(controller);
    try {
      await transport.flag(turnId, controller.signal);
      if (controller.signal.aborted) return;
      setTurns((previous) => previous.map((turn) => turn.id === turnId ? { ...turn, flagged: true } : turn));
      setToast("Reported");
    } catch {
      if (!controller.signal.aborted) setToast("Couldn't report message");
    } finally { requestsRef.current.delete(controller); }
  }, [transport]);

  const sendDisabled = sending || historyLoading || unavailable || input.trim().length === 0;

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
          opacity: 1,
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="npc-chat-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${npc.display_name}`}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(600px, 92vw)",
          maxHeight: "82dvh",
          overflowY: "auto",
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
              width: 44,
              height: 44,
              padding: 12,
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
          role="log"
          aria-label="Conversation"
          aria-busy={sending || historyLoading}
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
              color: "#A9B8C4",
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            ─── Conversation ───
          </div>
          {historyLoading && <p role="status">Loading earlier messages…</p>}
          {historyError && <p role="status" style={{ color: "#d0d5dd" }}>{historyError}</p>}
          {turns.length === 0 && !sending && !historyLoading && !historyError && (
            <div
              style={{
                color: "#A9B8C4",
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
            <div style={{ color: "#9ca3af", fontStyle: "italic", animation: "npc-think-breathe 1.6s ease-in-out infinite" }}>
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
            role="alert"
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
                disabled={sending || unavailable}
                onClick={() => sendMessage(input || retryPayload)}
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
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!e.repeat) sendMessage(input);
              }
            }}
            readOnly={sending || unavailable}
            aria-label="Message"
            aria-busy={sending}
            maxLength={MAX_MESSAGE_LENGTH}
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
              opacity: sending ? 0.6 : 1,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={sendDisabled}
            aria-label="Send"
            style={{
              background:
                sendDisabled ? "#1f2a3a" : "#002FA7",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#f1ffff",
              cursor:
                sendDisabled ? "not-allowed" : "pointer",
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
            role="status"
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
        @media (max-width: 700px) { :global(.npc-chat-panel textarea) { font-size: 16px !important; } }
        :global(.npc-chat-panel :focus-visible) { outline: 2px solid #e4bf6c; outline-offset: 3px; }
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

// Portrait uses the same four-direction sheet and fallback policy as the world.
function NPCPortrait({ npc }: { npc: NPCPersona }) {
  const sources = npcSpriteSources(npc.sprite_url, npc.slug);
  const [failed, setFailed] = useState<string[]>([]);
  const source = [sources.primary, sources.fallback].find((url) => !failed.includes(url));
  const initials = npc.display_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", background: "#142b35", border: "1px solid #31515b", borderRadius: 12 }}>
      <div role="img" aria-label={`Portrait of ${npc.display_name}`} style={{ width: 80, height: 80, overflow: "hidden", flexShrink: 0, display: "grid", placeItems: "center", color: "#fff0cf", fontSize: 24 }}>
        {source ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source} alt="" width={320} height={80}
            onError={() => setFailed((previous) => previous.includes(source) ? previous : [...previous, source])}
            style={{ width: 320, height: 80, maxWidth: "none", imageRendering: "pixelated", justifySelf: "start" }} />
        ) : initials}
      </div>
    </div>
  );
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
              color: turn.flagged ? "#E85050" : "#A9B8C4",
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
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        {!done && <span className="npc-cursor">_</span>}
      </span>
    </span>
  );
}
