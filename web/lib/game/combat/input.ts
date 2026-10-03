/**
 * The classes v2 input layer (design sheet §1.13 and the LOCKED kits): key presses and releases with their times in,
 * intents out. Taps; pair combos and double taps within COMBO_WINDOW (either order: a tap key that is part of a
 * combo waits up to the window for its partner, then fires alone); holds (start on the press, end on the release or
 * at max_s); charges (the release fires with how far it got between min_s and max_s); toggles; drawn shapes. A
 * recast is a tap here: the runtime keeps its window. Pure: the ruins scene feeds key events, the runtime runs the
 * intents (classRuntime.ts); the balance bot feeds the same.
 */
import { COMBO_WINDOW, type InputSpec } from "@/lib/combat/classes";

/** What each key does now (null: locked), and the combos as key-index pairs (`holds`: which combos have a held variant). */
export interface InputKit { inputs: (InputSpec | null)[]; combos: [number, number][]; holds?: boolean[]; window?: number }
/** A pair with a held variant (Riptide) held this long casts that instead; let go sooner, the pair's tap. */
export const HOLD_AFTER = 0.3;
export type Intent =
  | { kind: "tap"; slot: number }
  | { kind: "combo"; combo: number } | { kind: "comboHold"; combo: number }
  | { kind: "holdStart"; slot: number } | { kind: "holdEnd"; slot: number; held: number }
  | { kind: "chargeStart"; slot: number } | { kind: "charge"; slot: number; level: number }
  | { kind: "toggle"; slot: number }
  | { kind: "draw"; slot: number };

export interface InputState {
  /** A combo key's tap waiting for its partner. */
  pending: { slot: number; t: number } | null;
  /** Holds and charges under way: key index → when it went down. */
  down: Map<number, number>;
  /** A pair with a held variant, both keys down: tap or hold is decided on the release or at HOLD_AFTER. */
  pair: { combo: number; t: number; slots: [number, number] } | null;
}
export const createInputState = (): InputState => ({ pending: null, down: new Map(), pair: null });

const inCombo = (kit: InputKit, slot: number) => kit.combos.some(c => c[0] === slot || c[1] === slot);
const comboOf = (kit: InputKit, a: number, b: number) => kit.combos.findIndex(c => (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a));

/** A key went down (`t` in seconds, any clock that `tick` shares). */
export function press(s: InputState, kit: InputKit, slot: number, t: number): Intent[] {
  const spec = kit.inputs[slot];
  if (!spec || s.down.has(slot)) return []; // locked, or a key-repeat
  const out: Intent[] = [], window = kit.window ?? COMBO_WINDOW;
  if (s.pending) {
    const c = t - s.pending.t <= window ? comboOf(kit, s.pending.slot, slot) : -1;
    if (c >= 0 && spec.kind === "tap") {
      const first = s.pending.slot;
      s.pending = null;
      if (kit.holds?.[c]) { s.pair = { combo: c, t, slots: [first, slot] }; return []; }
      return [{ kind: "combo", combo: c }];
    }
    out.push({ kind: "tap", slot: s.pending.slot }); // its partner never came: it fires alone, first
    s.pending = null;
  }
  switch (spec.kind) {
    case "tap": case "recast":
      if (spec.kind === "tap" && inCombo(kit, slot)) s.pending = { slot, t };
      else out.push({ kind: "tap", slot });
      break;
    case "hold": s.down.set(slot, t); out.push({ kind: "holdStart", slot }); break;
    case "charge": s.down.set(slot, t); out.push({ kind: "chargeStart", slot }); break;
    case "toggle": out.push({ kind: "toggle", slot }); break;
    case "drawn": out.push({ kind: "draw", slot }); break;
  }
  return out;
}

/** A key came up. */
export function release(s: InputState, kit: InputKit, slot: number, t: number): Intent[] {
  if (s.pair?.slots.includes(slot)) { const combo = s.pair.combo; s.pair = null; return [{ kind: "combo", combo }]; } // let go in time: the pair's tap
  const at = s.down.get(slot), spec = kit.inputs[slot];
  if (at === undefined || !spec) return [];
  s.down.delete(slot);
  if (spec.kind === "hold") return [{ kind: "holdEnd", slot, held: t - at }];
  if (spec.kind === "charge") return [{ kind: "charge", slot, level: chargeLevel(t - at, spec.min_s, spec.max_s) }];
  return [];
}

/** Every frame: a lone combo tap past its window fires; a hold past max_s ends itself. */
export function tick(s: InputState, kit: InputKit, t: number): Intent[] {
  const out: Intent[] = [];
  if (s.pending && t - s.pending.t > (kit.window ?? COMBO_WINDOW)) { out.push({ kind: "tap", slot: s.pending.slot }); s.pending = null; }
  if (s.pair && t - s.pair.t >= HOLD_AFTER) { out.push({ kind: "comboHold", combo: s.pair.combo }); s.pair = null; }
  for (const [slot, at] of s.down) {
    const spec = kit.inputs[slot];
    if (spec?.kind === "hold" && t - at >= spec.max_s) { s.down.delete(slot); out.push({ kind: "holdEnd", slot, held: spec.max_s }); }
  }
  return out;
}

/** 0 at (or under) min_s, 1 at max_s and past it. */
export const chargeLevel = (held: number, min: number, max: number) => Math.min(1, Math.max(0, (held - min) / Math.max(1e-6, max - min)));
/** A charge's power: 0.5× uncharged to 1.5× full (design sheet: "release fires with power scaled 0.5–1.5"). */
export const chargePotency = (level: number) => 0.5 + level;
