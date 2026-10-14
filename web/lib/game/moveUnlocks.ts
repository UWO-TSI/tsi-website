/**
 * Moves a Keeper teaches (specs/v1-drop.md §1.6): you start with walk, run, jump, crouch and slide, sit and the emote
 * wheel; the dash (Q) and the leaf glider stay locked until a Keeper teaches them through a small quest (the quests come
 * later: `unlockMove` is their hook). A simple flag kept on this device. Everything is unlocked in development
 * (`?moves=locked` shows the shipped locks there).
 */
import { useSyncExternalStore } from "react";

export type LockedMove = "dash" | "glider";
export const LOCKED_MOVES: readonly LockedMove[] = ["dash", "glider"];
const KEY = "tsi.moves.v1";
type Store = Pick<Storage, "getItem" | "setItem"> | null;
const local = (): Store => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

/** The moves taught on this device (anything unknown in storage is ignored). */
export function readUnlocks(storage: Store = local()): Set<LockedMove> {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((m): m is LockedMove => LOCKED_MOVES.includes(m)) : []);
  } catch { return new Set(); }
}

/** Whether a move can be used: taught, or development (unless it asks to see the locks). */
export function moveUnlocked(move: LockedMove, s: { dev: boolean; unlocked: ReadonlySet<LockedMove>; devLocked?: boolean }): boolean {
  return (s.dev && !s.devLocked) || s.unlocked.has(move);
}

const listeners = new Set<() => void>();
let version = 0;
/** A Keeper taught it: kept, and everything reading the flags follows. */
export function unlockMove(move: LockedMove, storage: Store = local()): void {
  const next = readUnlocks(storage);
  next.add(move);
  try { storage?.setItem(KEY, JSON.stringify([...next])); } catch { /* this session only */ }
  version++;
  listeners.forEach(l => l());
}

const DEV = process.env.NODE_ENV !== "production";
const devLocked = () => DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("moves") === "locked";
let cache: { v: number; flags: Record<LockedMove, boolean> } | null = null;
function snapshot(): Record<LockedMove, boolean> {
  if (cache?.v === version) return cache.flags;
  const unlocked = readUnlocks(), locked = devLocked();
  const flags = { dash: moveUnlocked("dash", { dev: DEV, unlocked, devLocked: locked }), glider: moveUnlocked("glider", { dev: DEV, unlocked, devLocked: locked }) };
  cache = { v: version, flags };
  return flags;
}
const SERVER: Record<LockedMove, boolean> = { dash: DEV, glider: DEV };
/** Which locked moves you can use now. */
export function useMoveUnlocks(): Record<LockedMove, boolean> {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, snapshot, () => SERVER);
}
