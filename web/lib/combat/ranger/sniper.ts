/**
 * The Sniper (Ranger; "Sniper (LOCKED)"): long-range burst, a skill class and a glass cannon. A slow heavy shot from the
 * long rifle, once a second; through a head or a core (the inner part of a body) it always crits. Killstreak: +15% a
 * kill up to five, lost on a hit or 8 s without one. Scope (held), Piercing and Cluster rounds, Smoke Roll (mastery 3),
 * Tripwire. Ult: Final Shot. Stat direction: crit damage.
 */
import type { ClassKit } from "../classes";

const I = (k: string) => `/assets/game/classes/${k}.svg`;
const proj = { kind: "projectile" as const };

export const SNIPER: ClassKit = {
  key: "sniper", name: "Sniper", family: "Ranger", role: "damage", style: "skill",
  signature: { type: "rifle", name: "long rifle" },
  stat: { kind: "crit_damage", at1: 1.75, at20: 2.3 },
  fire: { rate: 1, power: 1.1, speed: 70, range: 18, look: "bullet", weak: 0.35, clip: { verb: "QuickShot", scale: 0.8 },
    vfx: { cast: "sniper.muzzle", travel: "sniper.tracer", impact: "sniper.hit" } },
  keys: [
    { key: "sniper.scope", name: "Scope", description: "Hold to scope in: +40% crit chance, a steadier aim (weak points ×1.5) and a closer view.", cooldown_s: 3, energy: 15,
      effects: [{ kind: "buff", stat: "crit", value: 0.4, duration: 8 }, { kind: "buff", stat: "scope", value: 1, duration: 8 }], input: { kind: "hold", max_s: 8 },
      clip: { verb: "Guard" }, vfx: { cast: "sniper.scope" }, icon: I("sniper-scope") },
    { key: "sniper.pierce", name: "Piercing Round", description: "A heavy round through the whole line.", cooldown_s: 6, energy: 25, heavy: true,
      effects: [{ ...proj, power: 2, speed: 90, range: 24, pierce: true, shot: "bullet", size: 0.3 }], clip: { verb: "DrawShot", scale: 0.7 },
      vfx: { cast: "sniper.muzzleBig", travel: "sniper.rail", impact: "sniper.pierceHit" }, icon: I("sniper-pierce") },
    { key: "sniper.cluster", name: "Cluster Round", description: "Bursts where it hits and throws four bomblets round it: for groups.", cooldown_s: 9, energy: 30, heavy: true,
      effects: [{ ...proj, power: 1.1, speed: 50, range: 18, splash: 1.8, cluster: { count: 4, power: 0.75, radius: 1.5, fx: "sniper.bomblet" }, shot: "bullet", size: 0.3 }], clip: { verb: "DrawShot", scale: 0.8 },
      vfx: { cast: "sniper.muzzleBig", travel: "sniper.tracer", impact: "sniper.cluster" }, icon: I("sniper-cluster") },
    { key: "sniper.smoke", name: "Smoke Roll", description: "Roll back through smoke, untouchable, keeping your speed: what's near loses you, and what's inside the smoke mostly misses.", cooldown_s: 9, energy: 20, unlock: 3,
      effects: [{ kind: "area", power: 0, radius: 3, at: "self", status: { distract: 1.5 } }, { kind: "zone", radius: 2.6, duration: 2.5, at: "self", blind: 0.6, fx: "sniper.smokeCloud" },
        { kind: "dash", distance: 3.5, back: true, iframes: true }, { kind: "momentum", speed: 3, back: true }],
      clip: { verb: "Backstep", scale: 1.1 }, vfx: { cast: "sniper.smoke" }, icon: I("sniper-smoke") },
    { key: "sniper.mine", name: "Tripwire", description: "A mine at your aim that blasts what comes close and slows it.", cooldown_s: 8, energy: 20,
      effects: [{ kind: "summon", unit: "sniper-mine" }], clip: { verb: "Plant", scale: 1.4 }, vfx: { cast: "sniper.mineSet", zone: "sniper.mineZone" }, icon: I("sniper-mine") },
  ],
  passive: { name: "Killstreak", description: "Each kill: +15% damage, five at most. Lost when you're hit or after 8 s without a kill.", kind: "killstreak", value: 0.15, cap: 5, icon: I("sniper-killstreak") },
  ult: { key: "sniper.ult", name: "Final Shot", description: "Time stops, the scope locks: one rail round through the whole field, every hit a crit.",
    cooldown_s: 0, energy: 0, charge: 1.0, anticipation_ms: 600, impacts: "first", reach: 6,
    effects: [{ ...proj, power: 6, speed: 120, range: 32, pierce: true, crit: true, shot: "bullet", size: 0.7 }],
    clip: { unique: "Ult_Sniper" }, vfx: { cast: "sniper.ultCharge", travel: "sniper.ultRail", impact: "sniper.ultHit" }, icon: I("sniper-ult") },
  ranks: [
    { at: 5, target: "sniper.pierce", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "sniper.cluster", change: { label: "+25% radius", radius: 1.25 } },
    { at: 9, target: "sniper.mine", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 11, target: "sniper.smoke", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 14, target: "sniper.scope", change: { label: "+20% crit chance while scoped", power: 1.2 } },
    { at: 16, target: "passive", change: { label: "+25% a kill", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#ffffff", "#a9c8ff", "#26305e"], mote: "halo", drift: "orbit", icon: I("sniper"), trim: { M_Fit: "#a9c8ff", M_Glass: "#ffffff" } },
};
