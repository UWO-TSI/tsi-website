/**
 * The match's sounds (David's approved effects plan, 2026-10-30: every effect and every contact's timing grade has a
 * sound), played through the game's audio (lib/game/audio.ts: the sfx volume, the master and mute apply). The files
 * are made in art/audio/synth_volleyball.py (ours, CC0; web/public/audio/sfx/SOURCES.md).
 *
 * A contact is its kind's body (a forearm bump, a fingertip set, a palm serve, a scoop, a block, the spike's crack)
 * with its grade on top: perfect a gold chime, good a clean tick, early a thin rising brush and late a dull falling
 * scuff, with the body softer and duller (early a touch higher, late lower). Bots' sounds fall off with distance, each
 * play gets a little pitch spread, and a sound can't stack on itself within a few hundredths of a second, so a long
 * rally stays easy on the ear.
 */
import { AudioManager, type SFXName } from "@/lib/game/audio";
import { onFx, type VbFx } from "./fxBus";
import type { ContactKind, Match, Timing } from "./match";
import { meterPower } from "./timing";
import { VB_FEEL } from "./feel";
import { volley } from "./session";

export interface Cue { name: SFXName; gain: number; rate: number; delay?: number }

/** Each contact kind's body and its level (the spike is the loudest hit; the files are balanced here). */
export const BODY: Record<ContactKind, { name: SFXName; gain: number }> = {
  bump: { name: "vb-bump", gain: 0.55 }, set: { name: "vb-set", gain: 0.6 }, jumpset: { name: "vb-set", gain: 0.62 },
  serve: { name: "vb-serve", gain: 0.65 }, dig: { name: "vb-dig", gain: 0.6 }, block: { name: "vb-block", gain: 0.62 }, spike: { name: "vb-spike", gain: 0.95 },
};
/** Each grade: the body's level and pitch, and the layer on top. */
export const GRADE: Record<Timing, { gain: number; rate: number; layer: SFXName; layerGain: number }> = {
  perfect: { gain: 1, rate: 1, layer: "vb-perfect", layerGain: 0.75 },
  good: { gain: 0.88, rate: 1, layer: "vb-good", layerGain: 0.6 },
  early: { gain: 0.6, rate: 1.07, layer: "vb-early", layerGain: 0.85 },
  late: { gain: 0.6, rate: 0.9, layer: "vb-late", layerGain: 0.85 },
};
/** The rally's heat: a rising shimmer at these touches, and the ball catching fire at FIRE_AT (the plan: about 6). */
export const HEAT_AT = [4, 6, 8, 10, 12, 14], FIRE_AT = 6;

export interface SfxContext {
  /** Your feet in the court's frame (null: no match): bots' sounds fall off with their distance. */
  me: { x: number; z: number } | null;
  /** Touches so far this rally (match.ts rallyTouches), read as the contact happens. */
  heat: number;
  /** 0..1, for the pitch spread (Math.random in play, fixed in tests). */
  rand: () => number;
}

const spread = (c: SfxContext, by = 0.04) => 1 + (c.rand() * 2 - 1) * by;
/** A sound from (x, z): full at your side, down to 45% across the court. */
const near = (c: SfxContext, x: number, z: number) => (c.me ? Math.max(0.45, Math.min(1, 1 - (Math.hypot(x - c.me.x, z - c.me.z) - 2) / 18)) : 1);

/** The sounds for one effect (pure: which files, how loud, how high, how late). */
export function cuesFor(e: VbFx, c: SfxContext): Cue[] {
  switch (e.kind) {
    case "contact": {
      const body = BODY[e.how], g = GRADE[e.timing], d = e.who === 0 ? 1 : near(c, e.x, e.z);
      const out: Cue[] = [
        { name: body.name, gain: body.gain * g.gain * d, rate: g.rate * spread(c) },
        { name: g.layer, gain: g.layerGain * d * (e.who === 0 ? 1 : 0.7), rate: spread(c, 0.02) },
      ];
      // The rally heats up: a shimmer every other touch from the 4th, higher each time; the ball catches fire at the 6th.
      if (e.how !== "serve" && HEAT_AT.includes(c.heat)) out.push({ name: "vb-heat", gain: 0.45, rate: Math.min(1.5, 0.9 + 0.06 * HEAT_AT.indexOf(c.heat)), delay: 0.05 });
      if (e.how !== "serve" && c.heat === FIRE_AT) out.push({ name: "vb-fire", gain: 0.55, rate: spread(c, 0.03), delay: 0.08 });
      return out;
    }
    case "land": {
      // The ball down ends the rally: in, the sand explodes (louder the faster it came); out, a dull drop and the whistle.
      if (!e.in) return [{ name: "vb-sand", gain: 0.5, rate: spread(c) }, { name: "vb-out", gain: 0.5, rate: spread(c, 0.02), delay: 0.18 }];
      const k = Math.min(1, e.speed / 18);
      return [{ name: "vb-boom", gain: 0.45 + 0.4 * k + Math.min(0.15, e.heat * 0.015), rate: (0.95 + 0.1 * (1 - k)) * spread(c, 0.03) }];
    }
    case "net": return [{ name: "vb-net", gain: 0.6, rate: spread(c, 0.06) }];
    case "tape": return [{ name: "vb-tape", gain: 0.55, rate: spread(c, 0.05) }];
    case "takeoff": return [{ name: "vb-takeoff", gain: e.who === 0 ? 0.6 : 0.4 * near(c, e.x, e.z), rate: spread(c, 0.08) }];
    case "touchdown": return [{ name: "vb-touchdown", gain: e.who === 0 ? 0.65 : 0.4 * near(c, e.x, e.z), rate: spread(c, 0.08) }];
    case "dive": return [{ name: e.strong ? "vb-slide" : "vb-dive", gain: (e.strong ? 0.8 : 0.7) * (e.who === 0 ? 1 : near(c, e.x, e.z)), rate: spread(c, 0.05) }];
    case "toss": return [{ name: "vb-toss", gain: 0.55, rate: 0.9 + 0.25 * e.power }, ...(e.max ? [{ name: "vb-max" as SFXName, gain: 0.7, rate: 1 }] : [])];
    case "whiff": return e.who === 0 ? [{ name: "vb-whiff", gain: 0.7, rate: spread(c, 0.08) }] : [];
    case "point": return [{ name: e.team === 0 ? "vb-point" : "vb-point-them", gain: e.team === 0 ? 0.6 : 0.5, rate: 1, delay: 0.15 }];
    case "win": return e.team === 0 ? [{ name: "vb-win", gain: 0.75, rate: 1, delay: 0.3 }] : [{ name: "vb-point-them", gain: 0.5, rate: 0.85, delay: 0.3 }];
    case "call": return [{ name: "vb-call", gain: 0.6, rate: spread(c, 0.05) }];
  }
}

/** The serve's charge while you hold: a tick every CHARGE_EVERY s, climbing with the meter (pure, for tests). */
export const CHARGE_EVERY = 0.1;
export function chargeCue(power: number): Cue {
  const top = power >= VB_FEEL.serve.maxPower;
  return { name: "vb-charge", gain: 0.35 + 0.35 * power + (top ? 0.1 : 0), rate: 0.8 + 1.0 * power };
}

/** No sound repeats within this (s): one event's echo in the same frame, a pile-up of bots. */
const REPEAT_GAP = 0.035;

function contextOf(m: Match | null): SfxContext {
  const me = m?.players[0].s;
  return { me: me ? { x: me.x, z: me.z } : null, heat: m?.rallyTouches ?? 0, rand: Math.random };
}

/** Listen for the match's effects and play their sounds, and tick the serve's charge; returns the unsubscribe. */
export function bindVolleySfx(): () => void {
  const last = new Map<SFXName, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const play = (q: Cue) => {
    const now = performance.now() / 1000;
    if (now - (last.get(q.name) ?? -1) < REPEAT_GAP) return;
    last.set(q.name, now);
    AudioManager.playSFX(q.name, { gain: q.gain, rate: q.rate });
  };
  const off = onFx(e => {
    for (const q of cuesFor(e, contextOf(volley.match))) {
      if (!q.delay) { play(q); continue; }
      const id = setTimeout(() => { timers.delete(id); play(q); }, q.delay * 1000);
      timers.add(id);
    }
  });
  // The charge: polled (the meter has no events), a tick every CHARGE_EVERY s while you hold.
  let raf = 0, nextTick = 0;
  const loop = (ms: number) => {
    const m = volley.match, t = ms / 1000;
    if (m?.meter != null) { if (t >= nextTick) { play(chargeCue(meterPower(m.meter))); nextTick = t + CHARGE_EVERY; } }
    else nextTick = 0;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { off(); cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.clear(); };
}
