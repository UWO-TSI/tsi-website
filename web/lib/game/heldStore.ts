"use client";

/**
 * What the player holds, the wheel's pins and the tool tiers they set (specs/game-ui.md): the local player's state
 * for the HUD and the avatar, kept on this device (a choice of what to carry, never ownership: the server checks
 * every tool it is sent). Published when it changes, never per frame.
 */
import { useSyncExternalStore } from "react";
import { EMPTY_HANDS, MAX_PINS, equip, quickSwap, reconcile, type HeldState, type WheelItem } from "./toolWheel";
import type { ToolKind } from "./tools";

export interface HeldStore extends HeldState { pins: string[]; chosen: Partial<Record<ToolKind, string>> }
const KEY = "tsi.held.v1";
const EMPTY: HeldStore = { ...EMPTY_HANDS, pins: [], chosen: {} };
let state: HeldStore = EMPTY, loaded = false;
const listeners = new Set<() => void>();

const str = (v: unknown) => (typeof v === "string" && v.length <= 80 ? v : null);
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HeldStore> | null;
    if (!raw || typeof raw !== "object") return;
    const chosen = Object.fromEntries(Object.entries(raw.chosen ?? {}).filter(([k, v]) => ["rod", "net", "shovel"].includes(k) && str(v)));
    state = { held: str(raw.held), last: str(raw.last), pins: (Array.isArray(raw.pins) ? raw.pins : []).map(str).filter((p): p is string => !!p).slice(0, MAX_PINS), chosen };
  } catch { /* empty hands */ }
}
function publish(next: HeldStore) {
  if (next === state) return;
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* this session only */ }
  listeners.forEach(l => l());
}
const read = () => { load(); return state; };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useHeld = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const readHeld = read;

/** Take out a wheel item (null: empty hands). */
export function holdItem(id: string | null) { const s = read(); const n = equip(s, id); if (n !== s) publish({ ...s, ...n }); }
/** The wheel key tapped: back to the last thing held. */
export function swapHeld(items: readonly WheelItem[]) { const s = read(); const n = quickSwap(s, items); if (n !== s) publish({ ...s, ...n }); }
/** The wheel's contents changed: drop (or swap to `fallback`) what is no longer on it. */
export function settleHeld(items: readonly WheelItem[], fallback: string | null = null) { const s = read(); const n = reconcile(s, items, fallback); if (n !== s) publish({ ...s, ...n }); }
/** Pin an item to the wheel (the oldest pin makes room), or unpin it. */
export function togglePin(key: string) {
  const s = read();
  publish({ ...s, pins: s.pins.includes(key) ? s.pins.filter(p => p !== key) : [...s.pins, key].slice(-MAX_PINS) });
}
/** Carry this tier of a tool on the wheel. */
export function chooseTool(kind: ToolKind, key: string) { const s = read(); if (s.chosen[kind] !== key) publish({ ...s, chosen: { ...s.chosen, [kind]: key } }); }
