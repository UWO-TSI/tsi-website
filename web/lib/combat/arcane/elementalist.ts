/**
 * The Elementalist (design sheet "Elementalist (LOCKED)"): four elements on 1–4, six pair combos, mana only; Cataclysm.
 * Numbers: specs/evidence/classes/K-arcane-balance.md; FX keys: lib/game/fx/arcane/*.ts; clips: the verb library and
 * art/characters/base/build_clips.py @unique; icons: public/assets/game/classes/elementalist/.
 */
import type { ClassAbility, ClassKit } from "../classes";
import type { Effect } from "../kits";
import { R, icon, area, zone } from "./shared";

const el = (key: string, name: string, description: string, energy: number, elements: string[], effects: Effect[], more: Partial<ClassAbility> = {}): ClassAbility =>
  ({ key: `elementalist.${key}`, name, description, cooldown_s: 0, energy, effects, elements, icon: icon("elementalist", key), ramp: R[elements[0]], ...more });

export const ELEMENTALIST: ClassKit = {
  key: "elementalist", name: "Elementalist", family: "Arcane", role: "damage", style: "skill",
  signature: { type: "prism-staff", name: "prism staff" },
  stat: { kind: "max_mana", at1: 120, at20: 200 },
  keys: [
    el("fireball", "Fireball", "A fireball that bursts where you aim (or on the first enemy in its way) and leaves the ground burning.", 14, ["fire"],
      [{ kind: "projectile", power: 0.4, speed: 17, range: 11, size: 0.35, burst: [area(0.85, 2.2, "self", { knock: 3, fx: "elementalist.fireball.burst" }), zone(1.5, 2.5, "self", { power: 0.25, fx: "elementalist.burn" })] }],
      { clip: { verb: "CastForward", scale: 1.15 }, vfx: { cast: "elementalist.fire.cast", travel: "elementalist.fireball.travel" } }),
    el("tidal-wave", "Tidal Wave", "A wave rolls out in front of you: it shoves enemies back and soaks them (slowed).", 16, ["water"],
      [area(0.6, 1.3, "self", { length: 7, knock: 6, status: { slow: [0.35, 2.5] } })],
      { clip: { verb: "Sweep" }, vfx: { cast: "elementalist.water.cast", impact: "elementalist.tidal-wave" } }),
    el("stone-javelin", "Stone Javelin", "Heave a heavy stone javelin at one enemy: a big hit that staggers.", 22, ["earth"],
      [{ kind: "projectile", power: 1.8, speed: 20, range: 12, size: 0.45, status: { hold: 0.7 } }],
      { heavy: true, clip: { unique: "Unique_Javelin" }, vfx: { cast: "elementalist.earth.cast", travel: "elementalist.javelin.travel", impact: "elementalist.javelin.hit" } }),
    el("gale-step", "Gale Step", "A burst of wind throws you forward and up, knocking back what's beside you. You keep the speed.", 10, ["wind"],
      [area(0.4, 1.7, "self", { knock: 5, fx: "elementalist.gale" }), { kind: "momentum", speed: 4 }, { kind: "launch", height: 0.7 }],
      { clip: { verb: "Backstep", scale: 0.8 }, vfx: { cast: "elementalist.wind.cast" } }),
  ],
  combos: [
    { keys: [0, 1], ability: el("steam-veil", "Steam Veil", "Fire and water: a scalding steam cloud round you. Enemies inside it miss you half the time.", 26, ["fire", "water"],
      [zone(3, 5, "self", { follow: true, blind: 0.5, power: 0.15, fx: "elementalist.steam" })], { ramp: R.steam, clip: { verb: "CastUp" }, vfx: { cast: "elementalist.steam.cast" } }) },
    { keys: [0, 3], ability: el("fire-tornado", "Fire Tornado", "Fire and wind: a burning tornado where you aim that wanders into the pack and drags enemies in.", 30, ["fire", "wind"],
      [zone(1.7, 5, "aim", { seek: 3.2, pull: 1.6, power: 0.6, every: 0.33, fx: "elementalist.tornado" })], { ramp: R.fire, clip: { verb: "Spin" }, vfx: { cast: "elementalist.fire.cast" } }) },
    { keys: [0, 2], ability: el("molten-pillars", "Molten Pillars", "Fire and earth: lava pillars erupt in a line toward your aim and leave lava burning behind.", 32, ["fire", "earth"],
      [area(1.4, 0.8, "self", { length: 8, knock: 3, fx: "elementalist.pillars" }), zone(0.75, 3, "self", { length: 8, power: 0.3, fx: "elementalist.lava" })],
      { unlock: 3, heavy: true, ramp: R.lava, clip: { verb: "Slam" }, vfx: { cast: "elementalist.earth.cast" } }) },
    { keys: [1, 2], ability: el("spring-grove", "Spring Grove", "Water and earth: a ring of flowers at your feet. Standing in it heals you.", 30, ["water", "earth"],
      [zone(2.4, 6, "self", { heal: 0.03, fx: "elementalist.grove" })], { unlock: 5, allies: 2.4, ramp: R.grove, clip: { verb: "Plant" }, vfx: { cast: "elementalist.grove.cast" } }) },
    { keys: [1, 3], ability: el("riptide", "Riptide", "Water and wind: a water whip pulls the enemy you aim at to you. Hold the pair to pull yourself to it instead.", 24, ["water", "wind"],
      [{ kind: "pull", range: 10, power: 0.6, status: { slow: [0.3, 2] } }], { unlock: 7, ramp: R.water, clip: { verb: "Throw" }, vfx: { cast: "elementalist.water.cast", impact: "elementalist.riptide" } }),
      hold: el("riptide", "Riptide", "Held: the water whip hauls you to the enemy you aim at, keeping the speed.", 24, ["water", "wind"],
        [{ kind: "dash", distance: 9, power: 0.7 }, { kind: "momentum", speed: 4 }], { unlock: 7, ramp: R.water, clip: { verb: "LeapStrike" }, vfx: { cast: "elementalist.riptide" } }) },
    { keys: [2, 3], ability: el("rampart", "Rampart", "Earth and wind: a stone wall bursts up where you aim, ramped on your side. It blocks shots; climb it or jump off it.", 28, ["earth", "wind"],
      [{ kind: "wall", width: 4.2, depth: 2.2, height: 1.5, duration: 8 }, area(0.6, 1.8, "aim", { knock: 6, fx: "elementalist.rampart" })],
      { unlock: 9, ramp: R.earth, clip: { verb: "Slam", scale: 0.9 }, vfx: { cast: "elementalist.earth.cast" } }) },
  ],
  passive: { name: "Attunement", description: "Casting a different element than the last builds your ult faster.", kind: "attunement", value: 0.4 },
  movement: { name: "Air Step", description: "Tap jump in the air: wind bursts under you and you jump again, keeping your speed (mana). Hold it to glide.", on: "airJump", energy: 12, cooldown_s: 0.35,
    effects: [{ kind: "launch", height: 0.85 }, { kind: "momentum", speed: 2 }], vfx: "elementalist.airstep" },
  ult: {
    key: "elementalist.cataclysm", name: "Cataclysm", icon: icon("elementalist", "cataclysm"), cooldown_s: 0, energy: 0, charge: 0.8, anticipation_ms: 450, impacts: "first",
    description: "Charge for 5 s, rooted and taking half damage, while storm clouds gather over your aim: press the numbers as they come. Then a meteor, a shockwave and a fire cyclone. Your accuracy scales it (50–150%).",
    channel: { seconds: 5, guard: 0.5, notes: 12 },
    effects: [
      area(5.5, 4.2, "aim", { knock: 6, status: { hold: 0.6 } }),
      { kind: "delay", seconds: 0.55, effects: [area(1.6, 6, "aim", { knock: 8, status: { hold: 1 }, fx: "elementalist.shockwave" })] },
      { kind: "delay", seconds: 1, effects: [zone(5, 1.3, "aim", { pull: 4.5, power: 1.2, every: 0.25, fx: "elementalist.cyclone" })] },
      { kind: "delay", seconds: 2.3, effects: [area(2.5, 3, "aim", { knock: 4, fx: "elementalist.slam" })] },
    ],
    ramp: ["#fff3fb", "#c08cff", "#3d2470"],
    clip: { unique: "Ult_Elementalist" }, vfx: { cast: "elementalist.cataclysm.charge", zone: "elementalist.storm", impact: "elementalist.meteor" },
  },
  ranks: [
    { at: 10, target: "ult", change: { label: "+10% power, 2 more notes", power: 1.1, notes: 2 } },
    { at: 11, target: "elementalist.fireball", change: { label: "+25% blast radius", radius: 1.25 } },
    { at: 12, target: "elementalist.steam-veil", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 12, target: "elementalist.fire-tornado", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 13, target: "elementalist.tidal-wave", change: { label: "+25% width", radius: 1.25 } },
    { at: 14, target: "elementalist.molten-pillars", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 14, target: "elementalist.spring-grove", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 15, target: "elementalist.fire-tornado", change: { label: "+25% radius", radius: 1.25 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 17, target: "elementalist.riptide", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 17, target: "elementalist.rampart", change: { label: "20% cheaper", energy: 0.8 } },
    { at: 18, target: "ult", change: { label: "+10% power, 2 more notes", power: 1.1, notes: 2 } },
    { at: 19, target: "elementalist.steam-veil", change: { label: "+25% radius", radius: 1.25 } },
    { at: 20, target: "elementalist.spring-grove", change: { label: "+25% radius", radius: 1.25 } },
  ],
  look: { ramp: ["#fff3fb", "#c08cff", "#3d2470"], mote: "flare", drift: "orbit", icon: "/assets/game/classes/elementalist.svg", trim: { M_Trim: "#c08cff", M_Accent: "#fff3fb" } },
};
