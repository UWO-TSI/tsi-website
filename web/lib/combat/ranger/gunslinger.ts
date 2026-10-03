/**
 * The Gunslinger (Ranger; "Gunslinger (LOCKED)"): rhythm damage, a basic-attack class. A six-round revolver: empty, it
 * reloads in 1.2 s (or R); a second R in the gold span reloads at once and the next six deal +25%, a miss jams it.
 * Last Round: the sixth chamber always crits. Ult: Russian Roulette, a warhead spun in with five golden rounds, every
 * shot hammer-cocked. Stat direction: reload speed.
 */
import type { ClassKit } from "../classes";

const I = (k: string) => `/assets/game/classes/${k}.svg`;
const shot = { kind: "projectile" as const };

export const GUNSLINGER: ClassKit = {
  key: "gunslinger", name: "Gunslinger", family: "Ranger", role: "damage", style: "basic",
  signature: { type: "sixgun", name: "revolver" },
  stat: { kind: "reload_speed", at1: 1, at20: 1.5 },
  fire: { rate: 3.2, power: 0.58, speed: 55, range: 11, look: "bullet", clip: { verb: "QuickShot", scale: 1.6 },
    ammo: { size: 6, reload_s: 1.2, gold: [0.45, 0.65], bonus: 0.25, miss_s: 0.6 },
    rounds: {
      explosive: { power: 0.62, splash: 1.7, tier: "ability", vfx: "gunslinger.boom" },
      gold: { power: 1.4, tier: "heavy", ult: true, vfx: "gunslinger.gold", travel: "gunslinger.goldTrail", cast: "gunslinger.muzzleBig" },
      warhead: { power: 6, blast: 5, tier: "ult", ult: true, big: true, vfx: "gunslinger.nuke", travel: "gunslinger.warheadTrail", cast: "gunslinger.muzzleBig" },
    },
    vfx: { cast: "gunslinger.muzzle", travel: "gunslinger.tracer", impact: "gunslinger.hit" } },
  keys: [
    { key: "gunslinger.fan", name: "Fan the Hammer", description: "Empty the cylinder in a fast cone, one shot a round.", cooldown_s: 5, energy: 15, ammo: "all",
      effects: [{ ...shot, power: 0.7, count: 6, spread: 0.5, speed: 50, range: 9, look: "bullet" }], clip: { unique: "Unique_FanHammer" },
      vfx: { cast: "gunslinger.fan", travel: "gunslinger.tracer", impact: "gunslinger.hit" }, icon: I("gunslinger-fan") },
    { key: "gunslinger.trick", name: "Trick Shot", description: "A round that ricochets between up to four enemies.", cooldown_s: 6, energy: 20, ammo: 1,
      effects: [{ ...shot, power: 1.3, speed: 45, range: 12, bounce: 3, look: "bullet" }], clip: { verb: "QuickShot", scale: 0.9 },
      vfx: { cast: "gunslinger.muzzle", travel: "gunslinger.trickTrail", impact: "gunslinger.ricochet" }, icon: I("gunslinger-trick") },
    { key: "gunslinger.special", name: "Special Rounds", description: "Load three explosive rounds into the next chambers.", cooldown_s: 10, energy: 20,
      effects: [{ kind: "load", rounds: ["explosive", "explosive", "explosive"] }], clip: { unique: "Unique_Reload" }, vfx: { cast: "gunslinger.load" }, icon: I("gunslinger-special") },
    { key: "gunslinger.roll", name: "Roll Reload", description: "Roll toward your aim, untouchable, thumbing two rounds in on the way.", cooldown_s: 8, energy: 15, unlock: 3,
      effects: [{ kind: "load", rounds: [], add: 2 }, { kind: "dash", distance: 3.5, iframes: true }, { kind: "momentum", speed: 3 }], clip: { verb: "Backstep", scale: 1.3 },
      vfx: { cast: "gunslinger.roll" }, icon: I("gunslinger-roll") },
    { key: "gunslinger.quickdraw", name: "Quickdraw", description: "Right after a reload: a shot that deals ×2 and staggers.", cooldown_s: 4, energy: 15, needs: "reloaded", ammo: 1,
      effects: [{ ...shot, power: 1.25, speed: 65, range: 12, status: { hold: 0.6 }, look: "bullet" }], clip: { verb: "QuickShot", scale: 1.3 },
      vfx: { cast: "gunslinger.muzzleBig", travel: "gunslinger.tracer", impact: "gunslinger.quickdraw" }, icon: I("gunslinger-quickdraw") },
  ],
  passive: { name: "Last Round", description: "The sixth chamber always crits.", kind: "last_round", value: 1, icon: I("gunslinger-lastround") },
  ult: { key: "gunslinger.ult", name: "Russian Roulette", description: "A warhead spun into the cylinder with five golden rounds. Cock and aim every shot: one of them is a nuke. 10 s to fire all six.",
    cooldown_s: 0, energy: 0, charge: 0.8, anticipation_ms: 500, impacts: "first", duration: 10, sequence: "trigger",
    effects: [{ kind: "load", rounds: ["warhead", "gold", "gold", "gold", "gold", "gold"], shuffle: true, cock: 0.6, window: 10 }],
    clip: { unique: "Ult_Gunslinger" }, vfx: { cast: "gunslinger.spin" }, icon: I("gunslinger-ult") },
  ranks: [
    { at: 5, target: "gunslinger.fan", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "gunslinger.trick", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 9, target: "gunslinger.special", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% damage while it lasts", add: [{ kind: "buff", stat: "damage", value: 0.1, duration: 10 }] } },
    { at: 11, target: "gunslinger.roll", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 14, target: "gunslinger.quickdraw", change: { label: "+20% power", power: 1.2 } },
    { at: 16, target: "passive", change: { label: "The last round deals +25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% damage while it lasts", add: [{ kind: "buff", stat: "damage", value: 0.1, duration: 10 }] } },
  ],
  look: { ramp: ["#fff3cf", "#5a8dff", "#1a2470"], mote: "sparkBurst", drift: "orbit", icon: I("gunslinger") },
};
