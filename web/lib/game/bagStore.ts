"use client";

/**
 * The backpack on this device (specs/game-ui.md milestone 2). The server's bag: GET /api/collections/bag, every write
 * through its POST or /api/economy/sell, each answered with the bag as it is now (the client never decides what you
 * have). This device keeps its own arrangement of the grid and the "New" marks, which stay until you look. Signed
 * out, the bag is this browser's record (lib/game/collections), shown but not changed.
 *
 * Events: `tsi:bag-got` { key } after a pickup is recorded (the mark, a reload, the HUD's fly-in), `tsi:bag-full`
 * { x?, z? } when one didn't fit, `tsi:bag-changed` after any write here.
 */
import { useSyncExternalStore } from "react";
import { BAG_START, CHEST_SLOTS, fits, slotsUsed, sortSlots, type Slot } from "@/lib/collections/bag";
import type { BagView } from "@/lib/collections/service";
import { API_WRITE, apiCall, newKey } from "@/lib/apiClient";
import { localCollections } from "./collections";

export interface BagState {
  /** The bag (null until it loads). */
  view: BagView | null;
  /** Signed out (or no server): this browser's record, read-only. */
  local: boolean;
  /** This device's arrangement: a key per slot (lib/collections/bag.ts arrange brings it up to the stock). */
  order: Slot[];
  /** Picked up since you last looked. */
  fresh: string[];
}

const KEY = "tsi.bag.v1";
const EMPTY: BagState = { view: null, local: false, order: [], fresh: [] };
let state: BagState = EMPTY, loaded = false;
const listeners = new Set<() => void>();

const keys = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string | null => k === null || (typeof k === "string" && k.length <= 64)) : []);
function boot() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<BagState> | null;
    if (raw) state = { ...state, order: keys(raw.order).slice(0, 200), fresh: keys(raw.fresh).filter((k): k is string => !!k) };
  } catch { /* a fresh grid */ }
  window.addEventListener("tsi:bag-got", e => {
    const key = (e as CustomEvent<{ key?: string }>).detail?.key;
    if (key && !state.fresh.includes(key)) set({ fresh: [...state.fresh, key] });
    void loadBag();
  });
  window.addEventListener("tsi:bag-full", () => void loadBag());
  window.addEventListener("tsi:eaten", () => void loadBag());
  // A sale at the shop counter, a pocket bought, a craft (it spends from the bag): read it again.
  window.addEventListener(API_WRITE, e => {
    const path = (e as CustomEvent<{ path?: string }>).detail?.path ?? "";
    if (/^\/api\/(economy\/(sell|buy)|crafting\/craft)/.test(path)) void loadBag();
  });
}
function set(next: Partial<BagState>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify({ order: state.order, fresh: state.fresh })); } catch { /* this session only */ }
  listeners.forEach(l => l());
}
const read = () => { boot(); return state; };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useBag = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const readBag = read;

/** This browser's record as a bag: no chest, the starting size, nothing locked. */
function localView(): BagView {
  const stock = localCollections();
  const items = Object.entries(stock).filter(([, n]) => n > 0).map(([item_key, count]) => ({ item_key, count, locked: false, best_size_cm: null }));
  return { items, capacity: BAG_START, used: slotsUsed(stock), chest: [], chest_capacity: CHEST_SLOTS, chest_used: 0, museum: {} };
}

let inflight: Promise<void> | null = null;
/** Read the bag again (a pickup, a sale, opening the bag). Signed out or with no server, this browser's record. */
export function loadBag(): Promise<void> {
  boot();
  inflight ??= fetch("/api/collections/bag").then(async res => {
    const json = await res.json().catch(() => null) as { ok?: boolean; bag?: BagView } | null;
    if (res.ok && json?.bag) set({ view: json.bag, local: false });
    else if (res.status === 401 || res.status === 503 || res.status === 404) set({ view: localView(), local: true });
  }, () => set({ view: localView(), local: true })).finally(() => { inflight = null; });
  return inflight;
}

const changed = () => window.dispatchEvent(new CustomEvent("tsi:bag-changed"));
/** A change to the bag on the server (lock, drop, store, take, store_materials); throws ApiError with the server's words. */
export async function bagWrite(body: Record<string, unknown>): Promise<BagView> {
  const write = body.action === "lock" ? body : { ...body, idempotency_key: newKey() };
  const view = await apiCall<BagView>("/api/collections/bag", "bag", write);
  set({ view, local: false });
  changed();
  return view;
}
/** Sell from the bag (the shop's own sale, /api/economy/sell): coins in, the bag read again. Returns what it paid. */
export async function sellFromBag(itemKey: string, qty: number): Promise<number> {
  const sale = await apiCall<{ paid: number }>("/api/economy/sell", "sale", { item_key: itemKey, qty, idempotency_key: newKey() });
  await loadBag();
  changed();
  return sale.paid;
}

/** Keep the grid as it shows now, so an emptied stack leaves its hole and the next pickup fills the first one. */
export function saveOrder(slots: readonly Slot[]) {
  if (slots.length !== state.order.length || slots.some((k, i) => k !== state.order[i])) set({ order: [...slots] });
}
/** Drag: swap two slots of the grid as it shows now (`slots`). */
export function swapSlots(slots: readonly Slot[], from: number, to: number) {
  const next = [...slots];
  [next[from], next[to]] = [next[to] ?? null, next[from] ?? null];
  set({ order: next });
}
/** Auto-sort: by type, then rarity. */
export function sortBag() {
  const stock = stockOf(state.view);
  set({ order: sortSlots(stock) });
}
/** You looked: the New marks go. */
export function seeBag() { if (state.fresh.length) set({ fresh: [] }); }

export const stockOf = (view: BagView | null | undefined, from: "items" | "chest" = "items"): Record<string, number> =>
  Object.fromEntries((view?.[from] ?? []).map(r => [r.item_key, r.count]));

/**
 * Is there room for one more (`key`: of this item; none: of anything needing its own slot, a fish)? True until the
 * server's bag has loaded, and signed out: the server decides, this only spares a cast or a shake it would refuse.
 */
export function bagRoom(key?: string): boolean {
  const { view, local } = read();
  if (!view || local) return true;
  return key ? fits(stockOf(view), view.capacity, key) : view.used < view.capacity;
}
