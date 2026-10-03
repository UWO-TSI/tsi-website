/**
 * The Marksman (Ranger; specs/classes/design-sheet.md "Marksman (LOCKED)"): mobile ranged damage, a basic-attack class.
 * Hold fire and keep moving: Focus ramps the recurve bow from 1.5 to 8 shots a second over about 4 s (a 0.5 s pause or a
 * hit halves it); arrows drop with distance. Keys 1–3 bend the arrows for 6 s (homing, flame, swift), 4 hops you back
 * still firing (mastery 3). Ult: Thousand Arrows. Stat direction: attack speed.
 */
import type { ClassKit } from "../classes";

const I = (k: string) => `/assets/game/classes/${k}.svg`;

export const MARKSMAN: ClassKit = {
  key: "marksman", name: "Marksman", family: "Ranger", role: "damage", style: "basic",
  signature: { type: "recurve", name: "recurve bow" },
  stat: { kind: "attack_speed", at1: 1, at20: 1.15 },
  fire: { rate: 1.5, power: 0.25, speed: 24, range: 13, look: "arrow", drop: 8, steady: true, clip: { verb: "QuickShot", scale: 1.4 },
    rounds: { surge: { power: 0.09, ult: true, tier: "light", vfx: "marksman.hit", travel: "marksman.surge" } },
    vfx: { cast: "marksman.loose", travel: "marksman.wake", impact: "marksman.hit" } },
  keys: [
    { key: "marksman.homing", name: "Homing Arrows", description: "For 6 s your arrows curve onto the nearest enemy ahead.", cooldown_s: 14, energy: 20,
      effects: [{ kind: "buff", stat: "homing", value: 1, duration: 6 }], clip: { verb: "CastUp", scale: 1.6 }, vfx: { cast: "marksman.homing" }, icon: I("marksman-homing") },
    { key: "marksman.flame", name: "Flame Arrows", description: "For 6 s your arrows ignite what they hit and leave burning ground.", cooldown_s: 14, energy: 25,
      effects: [{ kind: "buff", stat: "flame", value: 0.18, duration: 6 }], clip: { verb: "CastUp", scale: 1.6 }, vfx: { cast: "marksman.flame" }, icon: I("marksman-flame") },
    { key: "marksman.swift", name: "Swift Arrows", description: "For 6 s your arrows fly twice as fast, flat, and pierce one enemy.", cooldown_s: 14, energy: 20,
      effects: [{ kind: "buff", stat: "swift", value: 1, duration: 6 }], clip: { verb: "CastUp", scale: 1.6 }, vfx: { cast: "marksman.swift" }, icon: I("marksman-swift") },
    { key: "marksman.backhop", name: "Back Hop", description: "Hop back and keep firing: Focus and your momentum carry. Hold crouch to land into a slide.", cooldown_s: 6, energy: 15,
      effects: [{ kind: "momentum", speed: 4, back: true }, { kind: "launch", height: 0.7 }], unlock: 3, clip: { verb: "Backstep", scale: 1.2 }, vfx: { cast: "marksman.hop" }, icon: I("marksman-backhop") },
  ],
  passive: { name: "Focus", description: "Hold fire: 1.5 shots a second rising to 8 over 4 s while you keep shooting. A 0.5 s pause or a hit halves it.", kind: "focus", value: 8, cap: 4, icon: I("marksman-focus") },
  ult: { key: "marksman.ult", name: "Thousand Arrows", description: "Full Focus and all three arrows at once: 20 shots a second for 6 s, ending in a falling volley on your aim.",
    cooldown_s: 0, energy: 0, charge: 0.85, anticipation_ms: 350, impacts: "first-last", duration: 6,
    effects: [{ kind: "buff", stat: "homing", value: 1, duration: 6 }, { kind: "buff", stat: "flame", value: 0.18, duration: 6 }, { kind: "buff", stat: "swift", value: 1, duration: 6 },
      { kind: "buff", stat: "surge", value: 20, duration: 6 }],
    release: [{ kind: "area", power: 5, radius: 3.6, at: "aim", knock: 4 }],
    clip: { unique: "Ult_Marksman" }, vfx: { cast: "marksman.ultCharge", impact: "marksman.volley", zone: "marksman.ultDecal" }, icon: I("marksman-ult") },
  ranks: [
    { at: 5, target: "marksman.homing", change: { label: "+25% duration", duration: 1.25 } },
    { at: 7, target: "marksman.flame", change: { label: "−20% energy", energy: 0.8 } },
    { at: 9, target: "marksman.swift", change: { label: "+20% duration", duration: 1.2 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "marksman.backhop", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 14, target: "marksman.homing", change: { label: "−20% energy", energy: 0.8 } },
    { at: 16, target: "passive", change: { label: "Focus tops out at 8.5 shots a second", power: 1.0625 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#f2feff", "#62d8f0", "#0d4a5c"], mote: "speedLine", drift: "rise", icon: I("marksman") },
};
