/**
 * The Necromancer (design sheet "Necromancer (LOCKED)"): many weak skeletons, orders, corpse explosions, a pact, a bone surf; Army of the Dead.
 * Numbers: specs/evidence/classes/K-arcane-balance.md; FX keys: lib/game/fx/arcane/*.ts; clips: the verb library and
 * art/characters/base/build_clips.py @unique; icons: public/assets/game/classes/necromancer/.
 */
import type { ClassAbility, ClassKit } from "../classes";
import type { Effect } from "../kits";
import { icon } from "./shared";

const ne = (key: string, name: string, description: string, cooldown_s: number, energy: number, effects: Effect[], more: Partial<ClassAbility> = {}): ClassAbility =>
  ({ key: `necromancer.${key}`, name, description, cooldown_s, energy, effects, icon: icon("necromancer", key), ...more });

export const NECROMANCER: ClassKit = {
  key: "necromancer", name: "Necromancer", family: "Arcane", role: "damage", style: "skill",
  signature: { type: "bone-tome", name: "bone tome" },
  stat: { kind: "summon_count", at1: 1, at20: 5 },
  keys: [
    ne("raise-dead", "Raise Dead", "Corpses near your aim rise as skeleton warriors: weak, many, 20 s each. With no corpse, a bone wisp answers.", 5, 22,
      [{ kind: "raise", radius: 4.5, unit: "skeleton", max: 3, fallback: "bone-wisp" }], { clip: { unique: "Unique_Raise" }, vfx: { cast: "necromancer.raise" } }),
    ne("command", "Command", "Tap: all your minions charge the enemy you aim at. Tap again: they come back to guard you.", 1, 5,
      [{ kind: "command" }], { clip: { verb: "CastForward", scale: 1.4 }, vfx: { impact: "necromancer.command" } }),
    ne("corpse-explosion", "Corpse Explosion", "Blow up the minion or corpse nearest your aim. The blast chains through the corpses around it.", 6, 24,
      [{ kind: "detonate", range: 3.5, radius: 2.4, power: 1.5, chain: 3.5, links: 3 }], { clip: { verb: "Throw" }, vfx: { impact: "necromancer.explode" } }),
    ne("dark-pact", "Dark Pact", "Consume one of your minions: heal 12% and a bone shield of 12% for 6 s.", 10, 15,
      [{ kind: "consume", heal: 0.12, shield: 0.12, duration: 6 }], { allies: 0, clip: { verb: "CastUp" }, vfx: { cast: "necromancer.pact", impact: "necromancer.pact.drain" } }),
    ne("bone-surf", "Bone Surf", "Mid-slide: skeletal hands carry your slide for 1.5 s without losing speed, steerable, ploughing enemies aside. Jump off for a bigger slide-jump.", 8, 15,
      [{ kind: "surf", duration: 1.5, power: 0.9 }], { unlock: 3, when: "sliding", vfx: { cast: "necromancer.surf", zone: "necromancer.surf.trail" } }),
  ],
  passive: { name: "Grave Tithe", description: "Kills near you heal you 3% and leave corpses that last twice as long.", kind: "grave_tithe", value: 0.03, cap: 9 },
  ult: {
    key: "necromancer.army-of-the-dead", name: "Army of the Dead", icon: icon("necromancer", "army-of-the-dead"), cooldown_s: 0, energy: 0, charge: 0.8, anticipation_ms: 500, impacts: "last", duration: 3,
    description: "The ground cracks with green light: every corpse near your aim and thirty skeletons claw up, march on the pack and explode together.",
    effects: [{ kind: "raise", radius: 8, unit: "army-skeleton", max: 12 }, { kind: "summon", unit: "army-skeleton", count: 30, cap: 42 }],
    release: [{ kind: "burst" }],
    ramp: ["#f2fff4", "#9ee6a8", "#2e1f4a"],
    clip: { unique: "Ult_Necromancer" }, vfx: { cast: "necromancer.army.cast", impact: "necromancer.army.crack", zone: "necromancer.army.burst" },
  },
  ranks: [
    { at: 5, target: "necromancer.corpse-explosion", change: { label: "chains further (+25%)", radius: 1.25 } },
    { at: 7, target: "necromancer.raise-dead", change: { label: "-20% cooldown", cooldown: 0.8 } },
    { at: 9, target: "necromancer.bone-surf", change: { label: "surfs longer (+25%)", duration: 1.25 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "necromancer.dark-pact", change: { label: "+20% heal and shield", power: 1.2 } },
    { at: 14, target: "necromancer.corpse-explosion", change: { label: "+20% power", power: 1.2 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 20, target: "necromancer.bone-surf", change: { label: "surfs longer (+25%)", duration: 1.25 } },
  ],
  look: { ramp: ["#f2fff4", "#9ee6a8", "#2e1f4a"], mote: "bone", drift: "fall", icon: "/assets/game/classes/necromancer.svg", trim: { M_Trim: "#9ee6a8", M_Accent: "#2e1f4a" } },
};
