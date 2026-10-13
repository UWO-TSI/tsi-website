"use client";

/**
 * World chat's dock (specs/v1-drop.md §3; lib/net/chat.ts): Enter (or the chat button on a touch screen, in NetHud)
 * opens a slim cream bar at the bottom left with the session's log above it; Enter sends (and closes the bar), Escape
 * closes it. While it's open it is a world dialog (lib/game/useWorldDialog), so the world ignores your movement keys
 * as you type. Closed, the last few lines fade at the bottom left. A refused line comes back kindly: a notice in the
 * log, and your words back in the bar next time it opens. A name opens that player's card (mute, block, report).
 * "Chat is logged for moderation" sits over the log (specs/multiplayer-questions.md default 4).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Info, SendHorizontal } from "lucide-react";
import { useWorldDialog, worldKeysBlocked, isTyping } from "@/lib/game/useWorldDialog";
import { CHAT_MAX, RECENT_MS, chatStore, recentOf, type ChatEntry } from "@/lib/net/chat";
import { activeNet } from "./active";
import { openCard } from "./cards";
import s from "./chat.module.css";

// ── Open or closed: shared with the touch button (NetHud) ─────────

let barOpen = false;
const openListeners = new Set<() => void>();
export function setChatOpen(on: boolean) {
  if (barOpen === on) return;
  barOpen = on;
  for (const l of openListeners) l();
}
const subscribeOpen = (l: () => void) => { openListeners.add(l); return () => { openListeners.delete(l); }; };
export const useChatOpen = () => useSyncExternalStore(subscribeOpen, () => barOpen, () => false);

/** Whether an Enter on this element opens the chat: not while typing elsewhere, not on a focused button or link. */
export function enterOpensChat(e: { key: string; repeat?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; target: unknown }, blocked: boolean): boolean {
  if (e.key !== "Enter" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || blocked) return false;
  const el = e.target as (Element & { closest?: (s: string) => Element | null }) | null;
  if (isTyping(el)) return false;
  return !el?.closest?.("button, a[href], [role='button'], select, summary");
}

function Line({ e, fadeAt }: { e: ChatEntry; fadeAt?: number }) {
  const style = fadeAt === undefined ? undefined : ({ ["--fade-at" as string]: `${fadeAt.toFixed(2)}s` } as CSSProperties);
  if (e.kind === "notice") return <li className={s.notice} style={style}><Info size={13} aria-hidden />{e.text}</li>;
  return <li className={s.line} style={style} data-mine={e.mine || undefined}>
    {e.mine ? <span className={s.name}>You</span>
      : <button type="button" className={s.name} onClick={() => openCard({ uid: e.uid, name: e.name, sid: e.sid, lineId: e.id })} aria-label={`${e.name}: open their card`}>{e.name}</button>}
    <span>{e.text}</span>
  </li>;
}

/** The fading lines, re-read when a line comes and when the oldest one's time is up. */
function Recent({ entries }: { entries: readonly ChatEntry[] }) {
  const [now, setNow] = useState(() => Date.now());
  const shown = recentOf(entries, now);
  const oldest = shown[0]?.at;
  useEffect(() => {
    const at = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new line resets the clock the fades are timed against
    setNow(at);
    if (oldest === undefined) return;
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(50, oldest + RECENT_MS - at));
    return () => window.clearTimeout(t);
  }, [entries, oldest]);
  if (!shown.length) return null;
  // Each line starts its fade with what's left of its time.
  return <ol className={s.recent} aria-hidden="true">
    {shown.map(e => <Line key={e.id} e={e} fadeAt={Math.max(0, (e.at + RECENT_MS - 1200 - now) / 1000)} />)}
  </ol>;
}

export default function ChatDock({ hidden = false }: { hidden?: boolean }) {
  const chat = chatStore();
  const entries = useSyncExternalStore(chat.subscribe, chat.entries, chat.entries);
  const open = useChatOpen() && !hidden;
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLElement>(null);
  const close = () => setChatOpen(false);
  const panel = useWorldDialog<HTMLDivElement>(open, close, [], true);

  // Enter opens it (not while a dialog is up, a field is being typed in or a button has focus).
  useEffect(() => {
    if (hidden) return;
    const down = (e: KeyboardEvent) => {
      if (barOpen || !enterOpensChat(e, worldKeysBlocked())) return;
      e.preventDefault();
      setChatOpen(true);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [hidden]);
  // A cinematic (a talk, the boat) closes it.
  useEffect(() => { if (hidden) setChatOpen(false); }, [hidden]);

  // Opening: focus the bar, with a refused line's words back in it. Closing: the "…" comes down.
  useEffect(() => {
    if (!open) {
      const flag = chat.close();
      if (flag !== null) activeNet()?.sendTyping?.(flag);
      return;
    }
    const back = chat.takeRestore();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a refused line's words return to the bar as it opens
    if (back) setText(back);
    const t = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
    // A quiet spell lowers the "…".
    const idle = window.setInterval(() => { const flag = chat.idle(); if (flag !== null) activeNet()?.sendTyping?.(flag); }, 1000);
    return () => { window.clearTimeout(t); window.clearInterval(idle); };
  }, [open, chat]);
  // The log keeps to its newest line.
  useEffect(() => { if (open && log.current) log.current.scrollTop = log.current.scrollHeight; }, [open, entries]);

  const change = (next: string) => {
    setText(next);
    const flag = chat.draft(next.trim());
    if (flag !== null) activeNet()?.sendTyping?.(flag);
  };
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const words = text.trim();
    if (!words) { close(); return; }
    if (activeNet()?.sendChat?.(words)) { setText(""); close(); }
    else chat.refused("fast", "You're not with the others right now. Try again in a moment.");
  };
  const keys = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); send(); }
  };

  const left = CHAT_MAX - text.length;
  return <div className={s.dock} data-hidden={hidden || undefined} data-testid="chat-dock">
    {open ? <div ref={panel} tabIndex={-1} role="dialog" aria-label="Island chat" data-chat-open>
      <section ref={log} className={s.log} aria-label="Chat log">
        <p className={s.logNote}>Chat is logged for moderation.</p>
        {entries.length ? <ol className={s.logList} role="log" aria-live="polite">{entries.map(e => <Line key={e.id} e={e} />)}</ol>
          : <p className={s.empty}>Nothing said yet. Say hello!</p>}
      </section>
      <form className={s.bar} onSubmit={send} style={{ marginTop: 6 }}>
        <input ref={input} value={text} maxLength={CHAT_MAX} onChange={e => change(e.target.value)} onKeyDown={keys}
          placeholder="Say something nice" aria-label="Chat message" autoComplete="off" spellCheck enterKeyHint="send" />
        {left <= 40 && <span className={s.left} data-low={left <= 10 || undefined} aria-live="polite">{left}</span>}
        <button type="submit" className={s.send} aria-label="Send" disabled={!text.trim()}><SendHorizontal size={16} aria-hidden /></button>
      </form>
    </div> : <Recent entries={entries} />}
  </div>;
}
