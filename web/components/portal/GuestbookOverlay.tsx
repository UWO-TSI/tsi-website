"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";

/**
 * GuestbookOverlay (sprint E6) — DOM overlay rendered alongside the game
 * scene. Async community-feel surface: members sign the wall, everyone sees
 * the last 20. Loads on open, refreshes after each successful sign.
 *
 * Talks to:
 *   - GET  /api/guestbook
 *   - POST /api/guestbook  { message }
 */

const MAX_LEN = 200;

interface GuestbookEntry {
  id: string;
  message: string;
  created_at: string;
  display_name: string;
  tier: number;
}

interface GuestbookOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function GuestbookOverlay({ open, onClose }: GuestbookOverlayProps) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  const [justSigned, setJustSigned] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/guestbook");
      if (!res.ok) {
        setEntries([]);
        return;
      }
      const data = (await res.json()) as { entries?: GuestbookEntry[] };
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    }
  }, []);

  // ── Load on open ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setEntries(null);
    setErrorMsg(null);
    setInput("");
    loadEntries();
    const focusTimer = setTimeout(() => textareaRef.current?.focus(), 220);
    return () => clearTimeout(focusTimer);
  }, [open, loadEntries]);

  // ── ESC closes ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  // ── Auto-clear toast ────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const submit = useCallback(async () => {
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.status === 401) {
        setErrorMsg("Please sign in to leave a message.");
        return;
      }
      if (res.status === 429) {
        setErrorMsg("You've reached today's signing limit.");
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(body.error ?? "Please keep messages respectful.");
        return;
      }
      if (!res.ok) {
        setErrorMsg("Couldn't save your message. Try again.");
        return;
      }
      setInput("");
      setToast("Thanks!");
      // Loop iter 16 (2026-07-24): sign beat — pen-scratch two-blip into a
      // stamp note, and the fresh entry pops into the wall below.
      AudioManager.playSFX("blip1");
      window.setTimeout(() => AudioManager.playSFX("blip3"), 120);
      window.setTimeout(() => AudioManager.playSFX("confirm"), 280);
      setJustSigned(true);
      window.setTimeout(() => setJustSigned(false), 1200);
      await loadEntries();
    } catch {
      setErrorMsg("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }, [input, sending, loadEntries]);

  if (!open) return null;

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
          animation: "guestbookFadeIn 200ms ease-out",
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="TSI Guestbook"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(560px, 92vw)",
          maxHeight: "82vh",
          background: "var(--color-bg-navy)",
          border: "1px solid rgba(0, 47, 167, 0.3)",
          borderRadius: 16,
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.6)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: "#f1ffff",
          fontFamily: "'IBM Plex Mono', monospace",
          animation: "guestbookIn 200ms ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--glass-border-soft)",
            paddingBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            TSI Guestbook
          </span>
          <button
            onClick={onClose}
            aria-label="Close guestbook"
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
        </div>

        {/* Entries list */}
        <div
          style={{
            flex: 1,
            minHeight: 160,
            maxHeight: "44vh",
            overflowY: "auto",
            padding: "4px 2px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 13,
          }}
        >
          <style>{`
            @keyframes gb-pop {
              0% { transform: scale(0.85) translateY(6px); opacity: 0; }
              70% { transform: scale(1.02) translateY(-1px); opacity: 1; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}</style>
          {entries === null ? (
            <div
              style={{
                color: "#6b7280",
                fontStyle: "italic",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                color: "#6b7280",
                fontStyle: "italic",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              Be the first to sign the wall.
            </div>
          ) : (
            entries.map((entry, i) => (
              <div key={entry.id} style={i === 0 && justSigned ? { animation: "gb-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)" } : undefined}>
                <EntryBlock entry={entry} />
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(232, 80, 80, 0.12)",
              border: "1px solid rgba(232, 80, 80, 0.4)",
              borderRadius: 8,
              color: "#FFB4B4",
              fontSize: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Sign row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={sending}
            placeholder="Leave a note for the club..."
            rows={2}
            maxLength={MAX_LEN}
            style={{
              resize: "none",
              background: "var(--surface-hover)",
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#6b7280",
                letterSpacing: 0.5,
              }}
            >
              {input.length} / {MAX_LEN}
            </span>
            <button
              onClick={submit}
              disabled={sending || input.trim().length === 0}
              aria-label="Sign guestbook"
              style={{
                background:
                  sending || input.trim().length === 0
                    ? "#1f2a3a"
                    : "#002FA7",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "8px 14px",
                color: "#f1ffff",
                cursor:
                  sending || input.trim().length === 0
                    ? "not-allowed"
                    : "pointer",
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
                <Loader2 size={14} className="gb-spin" />
              ) : (
                <Send size={14} />
              )}
              Sign
            </button>
          </div>
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
        @keyframes guestbookFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes guestbookIn {
          from {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        :global(.gb-spin) {
          animation: gbSpin 0.9s linear infinite;
        }
        @keyframes gbSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

// ─── Single entry block ──────────────────────────────────────────────────────
function EntryBlock({ entry }: { entry: GuestbookEntry }) {
  return (
    <div
      style={{
        background: "var(--surface-hover)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#f1ffff", fontWeight: 700 }}>
            {entry.display_name}
          </span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 999,
              background: tierBg(entry.tier),
              color: tierColor(entry.tier),
              fontSize: 9,
            }}
          >
            T{entry.tier}
          </span>
        </div>
        <span style={{ color: "#6b7280" }}>
          {formatRelative(entry.created_at)}
        </span>
      </div>
      <div
        style={{
          color: "#f1ffff",
          fontSize: 13,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {entry.message}
      </div>
    </div>
  );
}

function tierBg(tier: number): string {
  if (tier === 1) return "rgba(255, 213, 79, 0.18)";
  if (tier === 2) return "rgba(126, 200, 80, 0.18)";
  if (tier === 3) return "rgba(74, 122, 255, 0.18)";
  return "var(--surface-chip)";
}

function tierColor(tier: number): string {
  if (tier === 1) return "#FFD54F";
  if (tier === 2) return "#9ADE6B";
  if (tier === 3) return "#7BA6FF";
  return "#9ca3af";
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
