/**
 * The Illusionist (design sheet "Illusionist (LOCKED)"): clones with their own minds, swaps, a mirror parry, a card to teleport to, Vanish; The Joker.
 * Numbers: specs/evidence/classes/K-arcane-balance.md; FX keys: lib/game/fx/arcane/*.ts; clips: the verb library and
 * art/characters/base/build_clips.py @unique; icons: public/assets/game/classes/illusionist/.
 */
import type { ClassAbility, ClassKit } from "../classes";
import type { Effect } from "../kits";
import { icon, area } from "./shared";

const il = (key: string, name: string, description: string, cooldown_s: number, energy: number, effects: Effect[], more: Partial<ClassAbility> = {}): ClassAbility =>
  ({ key: `illusionist.${key}`, name, description, cooldown_s, energy, effects, icon: icon("illusionist", key), ...more });

export const ILLUSIONIST: ClassKit = {
  key: "illusionist", name: "Illusionist", family: "Arcane", role: "support", style: "skill",
  signature: { type: "trick-deck", name: "deck" },
  stat: { kind: "duration", at1: 1, at20: 1.8 },
  keys: [
    il("mirror-clone", "Mirror Clone", "A double of you steps out: it dashes, strafes, throws your cards and copies what you do. 30% of your health, 40% of your damage, 10 s. Two at a time.", 14, 25,
      [{ kind: "summon", unit: "mirror-clone", count: 1, cap: 2 }], { clip: { verb: "Summon" }, vfx: { cast: "illusionist.clone" } }),
    il("swap", "Swap", "Trade places with the clone nearest your aim, keeping your speed. It heals you 5%.", 6, 12,
      [{ kind: "teleport", to: "unit", unit: "mirror-clone", heal: 0.05 }], { clip: { verb: "Backstep", scale: 1.4 }, vfx: { cast: "illusionist.swap", impact: "illusionist.swap" } }),
    il("mirror-ward", "Mirror Ward", "A 0.4 s mirror parry: a shot that reaches you goes back to its shooter. Look at a clone as it lands and it bounces through the clone: double, faster, a sure crit. Mistimed, it's spent.", 6, 15,
      [{ kind: "counter", window: 0.4, negate: 1, vs: "shot", reflect: 2.2 }], { clip: { verb: "Guard" }, vfx: { cast: "illusionist.ward", impact: "illusionist.reflect" } }),
    il("trick-card", "Trick Card", "Throw a card; press again within 3 s to teleport to it, keeping your speed and arc.", 5, 12,
      [{ kind: "projectile", power: 1.5, speed: 18, range: 11, shot: "card", mark: true }], { unlock: 3, input: { kind: "recast", window_s: 3 }, release: [{ kind: "teleport", to: "mark" }],
        clip: { unique: "Unique_CardFlick" }, vfx: { cast: "illusionist.card", travel: "illusionist.card.travel", impact: "illusionist.card.hit" } }),
    il("vanish", "Vanish", "Throw your cards in the air and disappear for 4 s: enemies lose you. Coming close or attacking reveals you; the first hit out of it deals 80% more.", 16, 20,
      [{ kind: "stealth", duration: 4, reveal: 1.6, bonus: 0.8 }], { clip: { unique: "Unique_Vanish" }, vfx: { cast: "illusionist.vanish" } }),
  ],
  passive: { name: "Who's Real?", description: "While clones stand, 30% of enemies go after a clone instead of you.", kind: "decoy_share", value: 0.3 },
  ult: {
    key: "illusionist.joker", name: "The Joker", icon: icon("illusionist", "joker"), cooldown_s: 0, energy: 0, charge: 0.8, anticipation_ms: 450, impacts: "last", duration: 1.6,
    description: "Throw the Joker: it becomes a huge mirror that sweeps the field. Its path turns to inverted colour and everything it crosses is pressed into the glass, then it shatters.",
    effects: [{ kind: "sweep", width: 9, speed: 6.5, distance: 10.4, hold: 0.8, effects: [area(8, 4.8, "self", { knock: 5, fx: "illusionist.shatter" })] }],
    release: [],
    clip: { unique: "Ult_Illusionist" }, vfx: { cast: "illusionist.joker.cast", impact: "illusionist.shatter" },
  },
  ranks: [
    { at: 5, target: "illusionist.swap", change: { label: "-20% cooldown", cooldown: 0.8 } },
    { at: 7, target: "illusionist.mirror-ward", change: { label: "+20% reflected power", power: 1.2 } },
    { at: 10, target: "illusionist.mirror-clone", change: { label: "3 clones at once; they use Mirror Clone", cap: 1 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "illusionist.trick-card", change: { label: "+20% power", power: 1.2 } },
    { at: 14, target: "illusionist.vanish", change: { label: "+20% ambush", power: 1.2 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 20, target: "illusionist.mirror-clone", change: { label: "4 clones at once; they swap and ward too", cap: 1 } },
    { at: 20, target: "illusionist.swap", change: { label: "heals 10%", power: 2 } },
  ],
  look: { ramp: ["#fff6ff", "#d79cff", "#4a2068"], mote: "card", drift: "orbit", icon: "/assets/game/classes/illusionist.svg", trim: { M_Trim: "#d79cff", M_Accent: "#fff6ff" } },
};
