"use client";

/**
 * The network store (specs/multiplayer.md §5.1): one NetSource per page, whichever component mounts it.
 *
 * - **Which source:** the `?bots=N` loopback in development (loopback.ts, lazy-loaded so no production bundle carries
 *   the bots), else none: multiplayer is off.
 * - **One per page:** a module singleton kept on `globalThis`, so Strict Mode's double mount and Fast Refresh find the
 *   same store rather than opening a second connection.
 * - **Acquire and release:** `useNetSource` acquires while `ready` and releases on unmount; the last release leaves
 *   after LEAVE_DELAY_MS, so a remount or a scene change inside it never drops the connection.
 * - **The area is the store's:** it joins with the current one, follows changes, and re-sends the latest after a
 *   rejoin. NetWorld never sends `area` itself.
 * - **React reads** `useNetStatus()` and `useRoster()` through useSyncExternalStore: they re-render only when the status
 *   or the roster changes, never per frame.
 */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { Area, RosterEntry } from "./protocol";
import type { NetSource, NetStatus } from "./types";
import { parseNetsim } from "./interp";

const DEV = process.env.NODE_ENV !== "production";
/** The last release leaves after this long (ms): Strict Mode's remount and a door's scene swap re-acquire inside it. */
export const LEAVE_DELAY_MS = 2000;

/** A source with its lifetime: what `useNetSource` drives. */
export interface NetStore {
  readonly source: NetSource;
  acquire(): void;
  release(): void;
  /** The scene you're in; the store sends it when it changes (and after any rejoin). */
  setArea(area: Area): void;
}

/** At most this many bots. */
export const MAX_BOTS = 64;
/** `?bots=N` (and `?seed=`): the loopback's options, or null without a valid count. */
export function botsFromSearch(search: string): { bots: number; seed: number } | null {
  const q = new URLSearchParams(search), raw = q.get("bots"), n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0 || n > MAX_BOTS) return null;
  const seed = Number(q.get("seed") ?? 1);
  return { bots: n, seed: Number.isInteger(seed) ? seed : 1 };
}

/** Where a page's multiplayer comes from: the dev loopback, or nothing. */
export type NetMode = { kind: "bots"; bots: number; seed: number } | null;
export function netMode(search: string, dev = DEV): NetMode {
  const bots = dev ? botsFromSearch(search) : null;
  return bots ? { kind: "bots", ...bots } : null;
}

/**
 * Acquire and release with a count and a delayed stop: `start` on the first acquire, `stop` LEAVE_DELAY_MS after the
 * last release unless something acquires again first.
 */
export function refCounted(start: () => void, stop: () => void, delay = LEAVE_DELAY_MS) {
  let refs = 0, running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    acquire() {
      refs++;
      if (timer) { clearTimeout(timer); timer = null; }
      if (!running) { running = true; start(); }
    },
    release() {
      if (refs === 0) return;
      if (--refs > 0) return;
      timer = setTimeout(() => {
        timer = null;
        if (refs === 0 && running) { running = false; stop(); }
      }, delay);
    },
    get refs() { return refs; },
    get running() { return running; },
  };
}

/** The loopback as a store: started on the first acquire with the latest area, stopped after the last release. */
export function loopbackStore(lb: { start(area: Area): void; stop(): void; setArea(area: Area): void } & NetSource): NetStore {
  let area: Area = "village", started = false;
  const life = refCounted(() => { started = true; lb.start(area); }, () => { started = false; lb.stop(); });
  return {
    source: lb,
    acquire: life.acquire,
    release: life.release,
    setArea(next) {
      area = next;
      if (started) lb.setArea(next);
    },
  };
}

// ── The page's one store ──────────────────────────────────────────

interface Holder { store: NetStore | null; loading: Promise<NetStore | null> | null; decided: boolean; listeners: Set<() => void> }
const KEY = "__tsiNetStore";
function holder(): Holder {
  const g = globalThis as unknown as Record<string, Holder | undefined>;
  return (g[KEY] ??= { store: null, loading: null, decided: false, listeners: new Set() });
}
const search = () => (typeof window === "undefined" ? "" : window.location.search);
function setStore(store: NetStore | null) {
  const h = holder();
  h.store = store;
  h.decided = true;
  h.loading = null;
  for (const l of h.listeners) l();
}

/** The store if it is ready now (null while the loopback loads, or with multiplayer off). */
function peekStore(): NetStore | null {
  const h = holder();
  if (h.store || h.decided || h.loading || typeof window === "undefined") return h.store;
  if (!netMode(search())) setStore(null);
  return h.store;
}
/** The store, loading the loopback's code first when the page asks for bots. */
function loadStore(): Promise<NetStore | null> {
  const h = holder();
  if (h.store || h.decided) return Promise.resolve(h.store);
  if (h.loading) return h.loading;
  const m = netMode(search());
  if (!m) { setStore(null); return Promise.resolve(null); }
  h.loading = import("./loopback").then(({ createLoopback }) => {
    const lb = createLoopback({ bots: m.bots, seed: m.seed, netsim: DEV ? parseNetsim(search()) : null });
    const store = loopbackStore(lb);
    setStore(store);
    return store;
  }, () => { setStore(null); return null; });
  return h.loading;
}

/**
 * The page's NetSource, or null when multiplayer is off (creating nothing). Acquired while `ready` (the world shown,
 * the creator done), released on unmount; `area` is the scene you're in.
 */
export function useNetSource({ area, ready }: { area: Area; ready: boolean }): NetSource | null {
  const [store, setLocal] = useState<NetStore | null>(peekStore);
  useEffect(() => {
    if (store) return;
    let alive = true;
    void loadStore().then(s => { if (alive && s) setLocal(s); });
    return () => { alive = false; };
  }, [store]);
  // The area first, so an acquire that connects joins with it.
  useLayoutEffect(() => { store?.setArea(area); }, [store, area]);
  useLayoutEffect(() => {
    if (!store || !ready) return;
    store.acquire();
    return () => store.release();
  }, [store, ready]);
  return store?.source ?? null;
}

const OFF: NetStatus = { kind: "off" };
const NOBODY: readonly RosterEntry[] = [];
/** Follow whichever store the page has (it may arrive after the first render). */
function subscribeStore(listener: () => void) {
  const h = holder();
  let unsub = h.store?.source.subscribe(listener) ?? null;
  const onStore = () => {
    unsub?.();
    unsub = holder().store?.source.subscribe(listener) ?? null;
    listener();
  };
  h.listeners.add(onStore);
  return () => { h.listeners.delete(onStore); unsub?.(); };
}
/** The connection's status; re-renders only when it changes. */
export function useNetStatus(): NetStatus {
  return useSyncExternalStore(subscribeStore, () => holder().store?.source.status() ?? OFF, () => OFF);
}
/** The whole shard, you included; re-renders only when someone joins, leaves or changes area. */
export function useRoster(): readonly RosterEntry[] {
  return useSyncExternalStore(subscribeStore, () => holder().store?.source.roster() ?? NOBODY, () => NOBODY);
}

/** Tests: forget the page's store. */
export function resetNetStore(): void {
  const h = holder();
  h.store?.source.leave();
  setStore(null);
  h.decided = false;
}
