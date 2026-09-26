"use client";

/**
 * Shared study hook for the 3D cafe and the phone companion (row 81).
 *
 * - Server-driven: a heartbeat every 30 s (and on every action / tab return)
 *   lets the server advance phases and keep the 5-minute grace alive. Browsers
 *   throttle background timers to about once a minute, well inside grace.
 * - Local countdown ticks from `phase_ends_at`; at zero it chimes and asks the
 *   server for the next phase.
 * - Tab title shows the countdown while a timer runs (row 169).
 * - Table chat is muted during your own focus by default (row 77) and
 *   unmutes on breaks; `setChatOpen` overrides until the next focus block.
 *
 *   const study = useStudySession();            // game or companion
 *   study.sit(tableId, seat); study.start({ focus_len: 25, break_len: 5, cycles: 4 });
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { playChime } from "./chime";
import type { ChatView } from "./chat";
import type { Settings, SessionView } from "./rules";
import type { MyStats, StudyState, Mate, TableView } from "./service";
import { httpStudyTransport, StudyRequestError, type StudyTransport } from "./transport";

export const HEARTBEAT_MS = 30_000;

export interface StudyHook {
  loaded: boolean;
  /** The API answered 401: show a sign-in prompt instead of tables. */
  signedOut: boolean;
  error: string | null;
  busy: boolean;
  session: SessionView | null;
  table: TableView | null;
  tables: TableView[];
  mates: Mate[];
  remaining: number | null;
  chatMuted: boolean;
  chat: ChatView[];
  sendChat: (body: string) => Promise<boolean>;
  reportChat: (id: string) => Promise<void>;
  lastEnded: SessionView | null;
  coinsEarned: number;
  stats: MyStats | null;
  setChatOpen: (open: boolean) => void;
  sit: (tableId: string, seat: number) => Promise<void>;
  start: (settings: Settings) => Promise<void>;
  takeBreak: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  lock: (isPrivate: boolean) => Promise<void>;
  setBoardOptIn: (on: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function formatClock(sec: number | null): string {
  if (sec === null) return "--:--";
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function useStudySession(opts: { transport?: StudyTransport; heartbeatMs?: number; title?: string; chime?: boolean } = {}): StudyHook {
  const transport = opts.transport ?? httpStudyTransport;
  const heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const [lastEnded, setLastEnded] = useState<SessionView | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [chat, setChat] = useState<ChatView[]>([]);
  const chimedFor = useRef<string | null>(null);
  const phaseKey = useRef<string | null>(null);

  const apply = useCallback((s: StudyState) => {
    setState(s);
    setFetchedAt(Date.now());
    setError(null);
    if (s.ended) setLastEnded(s.ended);
    if (s.settled_coins > 0) setCoinsEarned((c) => c + s.settled_coins);
    const key = s.session ? `${s.session.id}:${s.session.phase}:${s.session.cycle}` : null;
    if (key !== phaseKey.current) {
      phaseKey.current = key;
      if (s.session?.phase === "focus") setChatOpen(false);
    }
  }, []);

  const run = useCallback(
    async (f: () => Promise<StudyState>, quiet = false) => {
      if (!quiet) setBusy(true);
      try {
        apply(await f());
        setSignedOut(false);
      } catch (err) {
        if (err instanceof StudyRequestError && err.status === 401) {
          setSignedOut(true);
          setError(null);
          return;
        }
        setError(err instanceof StudyRequestError ? err.message : "Couldn't reach the cafe. Retrying.");
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [apply],
  );

  const refresh = useCallback(async () => {
    await run(() => transport.state(), true);
    try {
      setStats(await transport.stats());
    } catch {
      /* stats are optional */
    }
  }, [run, transport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = state?.session && state.session.phase !== "ended" ? state.session : null;

  // Heartbeat while seated; immediately when the tab comes back.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void run(() => transport.heartbeat(), true), heartbeatMs);
    const onVisible = () => document.visibilityState === "visible" && void run(() => transport.heartbeat(), true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active?.id, heartbeatMs, run, transport]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1 Hz local tick for your countdown and every visible studier's overhead timer.
  const ticking = !!active?.phase_ends_at || (state?.tables ?? []).some((t) => t.mates.some((m) => m.remaining_s !== null));
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const age = Math.floor((now - fetchedAt) / 1000);
  const tick = (m: Mate): Mate => (m.remaining_s === null ? m : { ...m, remaining_s: Math.max(0, m.remaining_s - age) });

  const remaining = active?.phase_ends_at ? Math.max(0, Math.ceil((Date.parse(active.phase_ends_at) - now) / 1000)) : null;

  // Table chat: fetched only while it's visible (unmuted), on each heartbeat cadence.
  const chatMuted = active?.phase === "focus" ? !chatOpen : active ? false : true;
  const chatActive = !!active && !chatMuted;
  useEffect(() => {
    if (!chatActive) return;
    let cancelled = false;
    const load = () => transport.chat().then((m) => !cancelled && setChat(m)).catch(() => undefined);
    void load();
    const id = setInterval(load, Math.min(heartbeatMs, 10_000));
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chatActive, transport, heartbeatMs]);

  // Block end: chime once, then let the server move the phase on.
  useEffect(() => {
    if (!active?.phase_ends_at || remaining !== 0 || chimedFor.current === active.phase_ends_at) return;
    chimedFor.current = active.phase_ends_at;
    if (opts.chime !== false) playChime();
    const t = setTimeout(() => void run(() => transport.heartbeat(), true), 1200);
    return () => clearTimeout(t);
  }, [remaining, active?.phase_ends_at, run, transport, opts.chime]);

  // Tab title countdown.
  const title = opts.title ?? "TSI";
  const label = active?.phase === "focus" ? "Focus" : active?.phase === "break" ? "Break" : null;
  useEffect(() => {
    if (!label) return;
    const previous = document.title;
    document.title = `${formatClock(remaining)} ${label} · ${title}`;
    return () => {
      document.title = previous;
    };
  }, [remaining, label, title]);

  return {
    loaded: state !== null,
    signedOut,
    error,
    busy,
    session: active,
    table: state?.table ?? null,
    tables: (state?.tables ?? []).map((t) => ({ ...t, mates: t.mates.map(tick) })),
    mates: (state?.table?.mates ?? []).map(tick),
    remaining,
    chatMuted,
    chat: chatActive ? chat : [],
    sendChat: async (body) => {
      try {
        setChat(await transport.sendChat(body));
        return true;
      } catch (err) {
        setError(err instanceof StudyRequestError ? err.message : "Couldn't send that.");
        return false;
      }
    },
    reportChat: async (id) => {
      try {
        setChat(await transport.reportChat(id));
      } catch {
        setError("Couldn't report that message.");
      }
    },
    lastEnded,
    coinsEarned,
    stats,
    setChatOpen,
    sit: (t, seat) => run(() => transport.sit(t, seat)),
    start: (s) => run(() => transport.start(s)),
    takeBreak: () => run(() => transport.takeBreak()),
    resume: () => run(() => transport.resume()),
    end: async () => {
      await run(() => transport.end());
      try {
        setStats(await transport.stats());
      } catch {
        /* optional */
      }
    },
    lock: async (p) => {
      if (state?.table) await run(() => transport.lock(state.table!.id, p));
    },
    setBoardOptIn: async (on) => {
      try {
        setStats(await transport.setBoardOptIn(on));
      } catch (err) {
        setError(err instanceof StudyRequestError ? err.message : "Couldn't save that.");
      }
    },
    refresh,
  };
}
