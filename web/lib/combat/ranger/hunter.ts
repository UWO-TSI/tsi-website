/**
 * The Hunter (Ranger; "Hunter (LOCKED)"): trapper and control; the field fills with traps (three at mastery 1, more and
 * longer as the duration stat grows). The harpoon crossbow is weapon and movement: its harpoon drags prey into the
 * traps or zips you to terrain (mastery 3). Prey: marked enemies take +30% from traps. Ult: The Great Hunt. Stat
 * direction: duration.
 */
import type { ClassKit } from "../classes";

const I = (k: string) => `/assets/game/classes/${k}.svg`;
const shot = { kind: "projectile" as const };

export const HUNTER: ClassKit = {
  key: "hunter", name: "Hunter", family: "Ranger", role: "support", style: "skill",
  signature: { type: "harpoon", name: "harpoon crossbow" },
  stat: { kind: "duration", at1: 1, at20: 1.7 },
  traps: 3,
  fire: { rate: 1.2, power: 1.4, speed: 30, range: 12, look: "harpoon", clip: { verb: "QuickShot", scale: 1 },
    vfx: { cast: "hunter.loose", travel: "hunter.wake", impact: "hunter.hit" } },
  keys: [
    { key: "hunter.camo", name: "Camouflage", description: "Blend in for 6 s: still, you're invisible; a slow walk stays hidden. Your first shot out deals +60%.", cooldown_s: 14, energy: 20,
      effects: [{ kind: "buff", stat: "stealth", value: 0.6, duration: 6 }], clip: { verb: "Guard", scale: 1.4 }, vfx: { cast: "hunter.camo" }, icon: I("hunter-camo") },
    { key: "hunter.snare", name: "Snare Trap", description: "A snare at your aim that roots what steps in for 2 s. It lunges at marked prey.", cooldown_s: 5, energy: 15,
      effects: [{ kind: "summon", unit: "snare-trap" }], clip: { verb: "Throw", scale: 1.3 }, vfx: { cast: "hunter.trapSet", zone: "hunter.trapZone" }, icon: I("hunter-snare") },
    { key: "hunter.spike", name: "Spike Trap", description: "Spikes burst from the ground round it and leave a bleed. It lunges at marked prey.", cooldown_s: 7, energy: 20,
      effects: [{ kind: "summon", unit: "spike-trap" }], clip: { verb: "Throw", scale: 1.3 }, vfx: { cast: "hunter.trapSet", zone: "hunter.trapZone" }, icon: I("hunter-spike") },
    { key: "hunter.mark", name: "Mark Prey", description: "A marking dart: +20% damage taken for 8 s, seen through walls; your traps lunge at it.", cooldown_s: 8, energy: 15,
      effects: [{ ...shot, power: 0.5, speed: 36, range: 15, status: { mark: [0.2, 8] }, look: "arrow" }], clip: { verb: "QuickShot" },
      vfx: { cast: "hunter.loose", travel: "hunter.markWake", impact: "hunter.mark" }, icon: I("hunter-mark") },
    { key: "hunter.harpoon", name: "Harpoon", description: "A harpoon on a chain: an enemy is dragged to you, into your traps; terrain zips you there, keeping your speed.", cooldown_s: 6, energy: 15, unlock: 3,
      effects: [{ ...shot, power: 1.1, speed: 32, range: 11, pull: 4, grapple: true, look: "harpoon", width: 0.3 }], clip: { verb: "DrawShot", scale: 0.8 },
      vfx: { cast: "hunter.loose", travel: "hunter.chain", impact: "hunter.harpoonHit" }, icon: I("hunter-harpoon") },
  ],
  passive: { name: "Prey", description: "Marked enemies take +30% from your traps.", kind: "prey", value: 0.3, icon: I("hunter-prey") },
  ult: { key: "hunter.ult", name: "The Great Hunt", description: "Every trap on the field springs at once and chains to the next; spectral hounds run down each mark.",
    cooldown_s: 0, energy: 0, charge: 0.85, anticipation_ms: 450, impacts: "first",
    effects: [{ kind: "trigger", power: 2.5, chain: 1.8, status: { hold: 1 } }],
    clip: { unique: "Ult_Hunter" }, vfx: { cast: "hunter.ultCharge", travel: "hunter.ultChain", impact: "hunter.ultHit", zone: "hunter.ultDecal" }, icon: I("hunter-ult") },
  ranks: [
    { at: 5, target: "hunter.snare", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 7, target: "hunter.spike", change: { label: "+20% power", power: 1.2 } },
    { at: 9, target: "hunter.mark", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 11, target: "hunter.harpoon", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 14, target: "hunter.camo", change: { label: "+25% duration", duration: 1.25 } },
    { at: 16, target: "passive", change: { label: "Traps deal +37% to marked prey", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#f4fff8", "#5fd1b0", "#123f3a"], mote: "mote", drift: "fall", icon: I("hunter") },
};
