/**
 * The Transmuter (design sheet "Transmuter (LOCKED, after the mobs talk)"): five forms on 1–5, one quick shared form cooldown, Perfect Shift; Chimera.
 * Numbers: specs/evidence/classes/K-arcane-balance.md; FX keys: lib/game/fx/arcane/*.ts; clips: the verb library and
 * art/characters/base/build_clips.py @unique; icons: public/assets/game/classes/transmuter/.
 */
import type { ClassAbility, ClassKit, FormDef } from "../classes";
import type { Effect } from "../kits";
import { icon, area, counter } from "./shared";

const FORMS: Record<string, FormDef> = {
  fox: { name: "Fox", trait: "fox-stride", body: "shadow-fox", scale: 1.15, speed: 0.15, basic: { kind: "melee", cooldown: 0.32, range: 1.8, arc: 1.8, power: 0.5, knock: 2 } },
  crab: { name: "Crab", trait: "crab-shell", body: "thorn-crab", scale: 1.15, block: 0.3, guard: 0.1, speed: -0.1, basic: { kind: "melee", cooldown: 0.6, range: 1.9, arc: 1.6, power: 0.9, knock: 3 } },
  wisp: { name: "Wisp", trait: "wisp-core", body: "rune-wisp", scale: 1.1, basic: { kind: "staff", cooldown: 0.42, range: 9.5, arc: 0, speed: 16, power: 0.64 } },
  pollen: { name: "Pollen", trait: "pollen-swarm", body: "pollen-sprite", scale: 2.6, speed: 0.3, basic: { kind: "bow", cooldown: 0.28, range: 7, arc: 0, speed: 22, power: 0.41, status: { slow: [0.2, 1] } } },
  golem: { name: "Golem", trait: "golem-fist", body: "stone-golem", scale: 0.8, guard: 0.4, speed: -0.15, basic: { kind: "melee", cooldown: 1.05, range: 2.6, arc: Math.PI * 2, power: 0.95, knock: 1 } },
  chimera: { name: "Chimera", body: "stone-golem", scale: 2.6, guard: 0.3, speed: 0.25, basic: { kind: "melee", cooldown: 0.5, range: 2.4, arc: 1.6, power: 0.85, knock: 2.5 } },
};
const form = (key: string, name: string, description: string, learn: string | undefined, effects: Effect[], more: Partial<ClassAbility> = {}): ClassAbility =>
  ({ key: `transmuter.${key}`, name, description, cooldown_s: 3, energy: 12, group: "form", learn, icon: icon("transmuter", key), effects: [{ kind: "form", form: key }, { kind: "transform", duration: 0.2 }, ...effects],
    clip: { unique: "Unique_Shift" }, ...more });

export const TRANSMUTER: ClassKit = {
  key: "transmuter", name: "Transmuter", family: "Arcane", role: "damage", style: "skill",
  signature: { type: "tooth-charm", name: "tooth charm" },
  stat: { kind: "cooldown", at1: 1, at20: 0.25 },
  keys: [
    form("fox", "Fox Form", "Shift into the fox and lunge through your aim. Click: a fast bite combo. Perfect Shift: you slip the hit.", undefined,
      [counter(1, [{ kind: "momentum", speed: 3 }]), { kind: "dash", distance: 4.2, power: 0.85 }], { vfx: { cast: "transmuter.shift", impact: "transmuter.fox" } }),
    form("crab", "Crab Form", "Shift into the crab and raise your shell: front hits are mostly blocked. Click: a pinch. Perfect Shift: you block it and pinch back.", "crab-shell",
      [counter(1, [area(1.2, 2.2, "self", { arc: 1.8, knock: 5, fx: "transmuter.pinch" })]), { kind: "buff", stat: "block", value: 0.85, duration: 1.2 }], { vfx: { cast: "transmuter.shift", impact: "transmuter.crab" } }),
    form("wisp", "Wisp Form", "Shift into the wisp and blink toward your aim, hovering. Click: rune bolts. Perfect Shift: you blink away.", "wisp-core",
      [counter(1, [{ kind: "dash", distance: 3, back: true }]), { kind: "dash", distance: 3.2 }, { kind: "launch", height: 0.45 }], { vfx: { cast: "transmuter.shift", impact: "transmuter.wisp" } }),
    form("pollen", "Pollen Form", "Burst into a sprite swarm: flit fast and untouchable for a moment, keeping your speed. Click: sting. Perfect Shift: you scatter, leaving slowing pollen.", "pollen-swarm",
      [counter(1, [area(0, 2.2, "self", { status: { slow: [0.4, 2] }, fx: "transmuter.pollen" })]), { kind: "buff", stat: "speed", value: 0.5, duration: 1.5 }, { kind: "momentum", speed: 3 },
        { kind: "stealth", duration: 0.6, reveal: 0, bonus: 0 }, { kind: "dash", distance: 2.2 }],
      { vfx: { cast: "transmuter.shift", impact: "transmuter.pollen" } }),
    form("golem", "Golem Form", "Shift into the golem and slam the ground. Click: slams and shockwaves. Perfect Shift: you take it without flinching and slam back.", "golem-fist",
      [counter(0.7, [area(1.8, 2.6, "self", { knock: 5, fx: "transmuter.slam" })]), area(1.35, 2.8, "self", { knock: 4, status: { hold: 0.3 }, fx: "transmuter.slam" })],
      { heavy: true, vfx: { cast: "transmuter.shift" } }),
  ],
  forms: FORMS,
  passive: { name: "Shed Skin", description: "Each shift leaves a small barrier (1% of your health for 3 s).", kind: "transform_shield", value: 0.01 },
  ult: {
    key: "transmuter.chimera", name: "Chimera", icon: icon("transmuter", "chimera"), cooldown_s: 0, energy: 0, charge: 0.9, anticipation_ms: 450, impacts: "last", duration: 10,
    description: "All your forms fuse into a chimera three times your size for 10 s: more damage, more guard, more speed, and the forms' moves with no cooldowns. It ends in a giant pounce.",
    effects: [{ kind: "form", form: "chimera" }, { kind: "transform", duration: 10 }, area(1.5, 3, "self", { knock: 5, fx: "transmuter.fuse" })],
    release: [{ kind: "dash", distance: 6, power: 2 }, area(6, 4, "self", { knock: 7, status: { hold: 0.8 }, fx: "transmuter.pounce" }), { kind: "form", form: "previous" }],
    clip: { unique: "Ult_Transmuter" }, vfx: { cast: "transmuter.chimera.cast", impact: "transmuter.pounce" },
  },
  ranks: [
    { at: 4, target: "transmuter.fox", change: { label: "+20% lunge", power: 1.2 } },
    { at: 6, target: "transmuter.crab", change: { label: "+20% block", power: 1.2 } },
    { at: 8, target: "transmuter.wisp", change: { label: "+25% hover", radius: 1.25 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "transmuter.pollen", change: { label: "+20% swarm", duration: 1.2 } },
    { at: 14, target: "transmuter.golem", change: { label: "+25% radius", radius: 1.25 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#fff8ee", "#b48cff", "#33204f"], mote: "beast", flicker: 5, drift: "rise", icon: "/assets/game/classes/transmuter.svg", trim: { M_Trim: "#b48cff", M_Accent: "#ffb347" } },
};
