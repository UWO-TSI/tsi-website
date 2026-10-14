/**
 * Development only: the character-effect bench's switches (specs/perf/effects-cost.md, specs/perf/fx-bench.mjs). Each
 * of the other players' effects can be turned off (`off`) or forced on for everyone (`force`), and the players stood in
 * a fixed block in front of you (`formation`), so the bench can measure what one effect costs at 1, 12 and 24 players
 * with nothing else changing. Set from the page (`?fxoff=dust,juice&fxforce=ghost&formation=1`) or at run time
 * (`window.__fx.set({...})`). In production every effect is on and nothing is forced: `fxOn` is always true and
 * `fxForced` always false, whatever the URL says.
 *
 * World switches for the world bench (specs/perf/world-bench.mjs): `skyDome` off draws the flat gradient on High as
 * Lite does, and `window.__fx.tune(group, key, value)` sets a tuning value (the grass's density) as /lab/tune does.
 */
import { useSyncExternalStore } from "react";
import { resetTuning, setTuning, type Tuning } from "@/lib/game/tuning";

export const FX_BENCH = process.env.NODE_ENV !== "production";

/** The effects the bench switches, on the other players (specs/perf/effects-cost.md has what each one covers). */
export const FX_KEYS = ["auraFamily", "auraSubclass", "dust", "juice", "ghost", "leaf", "held", "weapon", "rod", "fishing", "plates", "shadows", "emotes", "interp"] as const;
export type FxKey = (typeof FX_KEYS)[number];
/** World costs the bench can switch off (not other players' effects: `fxoff=all` leaves these on). */
export const WORLD_KEYS = ["skyDome"] as const;
export type WorldKey = (typeof WORLD_KEYS)[number];
type BenchKey = FxKey | WorldKey;

export interface FxBenchState {
  readonly off: ReadonlySet<BenchKey>;
  readonly force: ReadonlySet<FxKey>;
  /** Stand every other player in a block in front of you, facing about (their own motion still plays). */
  readonly formation: boolean;
}

const isKey = (s: string): s is FxKey => (FX_KEYS as readonly string[]).includes(s);
const isBenchKey = (s: string): s is BenchKey => isKey(s) || (WORLD_KEYS as readonly string[]).includes(s);
const keys = (list: string | null | undefined) => new Set((list ?? "").split(",").map(s => s.trim()).filter(isKey));
const offKeys = (list: string | null | undefined) => new Set((list ?? "").split(",").map(s => s.trim()).filter(isBenchKey));

function fromSearch(): FxBenchState {
  if (!FX_BENCH || typeof window === "undefined") return { off: new Set(), force: new Set(), formation: false };
  const q = new URLSearchParams(window.location.search), all = q.get("fxoff") === "all";
  return { off: all ? new Set(FX_KEYS) : offKeys(q.get("fxoff")), force: keys(q.get("fxforce")), formation: q.get("formation") === "1" };
}

let state: FxBenchState = fromSearch();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;

/** Whether the other players' `key` effect (or the world's `key` cost) draws (always, outside development). */
export const fxOn = (key: BenchKey): boolean => !FX_BENCH || !state.off.has(key);
/** Whether the bench forces `key` on every other player in view (never, outside development). */
export const fxForced = (key: FxKey): boolean => FX_BENCH && state.force.has(key);
/** The players stand in the bench's block. */
export const fxFormation = (): boolean => FX_BENCH && state.formation;

/** Replace any of the switches (lists of keys, or "all" to name every one). */
export function setFxBench(next: { off?: readonly string[] | "all"; force?: readonly string[] | "all"; formation?: boolean }): FxBenchState {
  if (!FX_BENCH) return state;
  const list = (v: readonly string[] | "all") => new Set<FxKey>(v === "all" ? FX_KEYS : v.filter(isKey));
  const offList = (v: readonly string[] | "all") => new Set<BenchKey>(v === "all" ? FX_KEYS : v.filter(isBenchKey));
  state = { off: next.off ? offList(next.off) : state.off, force: next.force ? list(next.force) : state.force, formation: next.formation ?? state.formation };
  for (const l of listeners) l();
  return state;
}

/** The switches as React state (components that mount or unmount an effect re-render when they change). */
export const useFxBench = (): FxBenchState => useSyncExternalStore(subscribe, snapshot, snapshot);

if (FX_BENCH && typeof window !== "undefined") {
  Object.assign(window, { __fx: {
    keys: FX_KEYS,
    set: (next: Parameters<typeof setFxBench>[0]) => { const s = setFxBench(next); return { off: [...s.off], force: [...s.force], formation: s.formation }; },
    state: () => ({ off: [...state.off], force: [...state.force], formation: state.formation }),
    /** A tuning value as /lab/tune sets it (`tune("grass", "density", 0.5)`); `tune()` puts the shipped values back. */
    tune: (group?: keyof Tuning, key?: string, value?: number) => { if (group && key && value !== undefined) setTuning(group, key as never, value); else resetTuning(); },
  } });
}
