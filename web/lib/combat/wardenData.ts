/**
 * The Warden family's data for classes v2 (specs/classes/design-sheet.md: Summoner, Shaman, Druid and Priest LOCKED):
 * the field primitives its kits are written in, the units they call (beasts, totems, spirits), the four signature
 * weapons with their five tiers, and the Summoner's taming order. Pure data with type-only imports, so kits.ts and
 * weapons.ts can spread it without an import cycle at load.
 */
import type { Effect, UnitDef } from "./kits";
import type { WeaponDef } from "./weapons";

/**
 * Field primitives (lib/game/combat/field.ts runs them; shared, each with its tests): things that stay on the ground or
 * on you after the cast. (Named apart from the other families' `zone`, `wall` and `pull`: different shapes, so both stand.)
 * - ground: a ground area that stays `duration` s (× the duration stat; radius × the area stat), pulsing every `every` s:
 *   `power` to enemies inside, `slow` while inside, `hold` s on each pulse; it heals you `heal` of max HP per second
 *   while you stand in it (× healing power); `drain` returns that share of its damage to you as health; `growth` counts
 *   for Overgrowth; `sink` drags enemies inside (a stronger slow that grows to a hold at its end). At you (`follow`
 *   keeps it on you), at the aim, or as a line `length` u long behind you (a dash's trail). One per `key` at a time.
 * - throw: a unit flies `flight` s on an arc to the aim (or drops under you, `at: "self"`), plants there, and hits
 *   what it lands on (`power`, `hold` in `radius`).
 * - channel: `effects` again every `every` s for `duration` s toward your current aim; a dodge ends it.
 * - barrier: a wall `length` u across the aim, `duration` s: enemies can't walk or shoot through it; touching it cuts and slows.
 * - root: you can't move for `duration` s (your skills still work).
 * - tether: a vine to the aim (≤ `range` u): while the key is held you swing toward it (`pull` u/s each second).
 * - fade: translucent for `duration` s (afterimages, a faded body); `rabbits` pour out round you as one instanced effect.
 * - overcharge: every linked totem unloads (a burst of `radius`/`power` at each, the links flash at `link`), ×(1 + `per`
 *   per enemy enclosed by the links, up to ×`max`).
 * - awaken: any missing totem is planted round the aim (`ring` u out) and every totem's spirit rises for `duration` s.
 * - rise: every tamed beast rises at once (past the cap) for `duration` s, and your dash warps inside a `radius` garden.
 */
export type FieldEffect =
  | { kind: "ground"; key: string; at: "self" | "aim" | "path"; radius: number; duration: number; every?: number; power?: number; slow?: number; hold?: number;
      heal?: number; drain?: number; growth?: boolean; sink?: boolean; follow?: boolean; length?: number }
  | { kind: "throw"; unit: string; flight: number; power: number; hold: number; radius: number; at?: "self" }
  | { kind: "channel"; duration: number; every: number; effects: Effect[] }
  | { kind: "barrier"; length: number; duration: number; power: number; every: number; slow: number }
  | { kind: "root"; duration: number }
  | { kind: "tether"; range: number; pull: number }
  | { kind: "fade"; duration: number; rabbits?: number }
  | { kind: "overcharge"; radius: number; power: number; link: number; per: number; max: number }
  | { kind: "awaken"; duration: number; ring: number }
  | { kind: "rise"; duration: number; radius: number };
export const FIELD_KINDS = new Set<string>(["ground", "throw", "channel", "barrier", "root", "tether", "fade", "overcharge", "awaken", "rise"]);

/**
 * The Warden's units (kits.ts UNITS): the Summoner's shadow beasts (minions that borrow their beast model; the wolves come
 * as a pair, half a beast each, so "out at once" counts beasts), the Shaman's three totems and the hop's spirit post
 * (totems, one of each at a time, three at most), and the spirits Spirit Awakening raises. `driven`: its own module moves
 * and fights it (lib/game/combat/totems.ts); the shared minion AI only ages it.
 */
export const WARDEN_UNITS: Record<string, UnitDef> = {
  "beast-wolf": { key: "beast-wolf", name: "Shadow wolf", kind: "minion", hp: 110, cost: 0.5, speed: 7, range: 1.4, power: 0.14, rate: 0.75, model: "beast-wolf" },
  "beast-owl": { key: "beast-owl", name: "Shadow owl", kind: "minion", hp: 70, cost: 1, speed: 9, range: 1.5, power: 0.26, rate: 1.1, model: "beast-owl" },
  "beast-toad": { key: "beast-toad", name: "Shadow toad", kind: "minion", hp: 280, cost: 1, speed: 3.4, range: 1.7, power: 0.26, rate: 1.2, taunt: true, model: "beast-toad" },
  "beast-serpent": { key: "beast-serpent", name: "Shadow serpent", kind: "minion", hp: 150, cost: 1, speed: 6, range: 1.9, power: 0.4, rate: 1.0, model: "beast-serpent" },
  "totem-storm": { key: "totem-storm", name: "Storm totem", kind: "totem", hp: 120, life: 24, radius: 5.5, model: "totem-storm", driven: true },
  "totem-fire": { key: "totem-fire", name: "Fire totem", kind: "totem", hp: 120, life: 24, radius: 2.5, model: "totem-fire", driven: true },
  "totem-earth": { key: "totem-earth", name: "Earthbind totem", kind: "totem", hp: 160, life: 24, radius: 3.4, model: "totem-earth", driven: true },
  "totem-spirit": { key: "totem-spirit", name: "Spirit post", kind: "totem", hp: 40, life: 6, radius: 0, model: "totem-spirit", driven: true, uncapped: true },
  "spirit-thunderbird": { key: "spirit-thunderbird", name: "Thunderbird", kind: "minion", hp: 999, cost: 0, speed: 9, range: 7, power: 1.0, rate: 0.5, model: "spirit-thunderbird", driven: true },
  "spirit-salamander": { key: "spirit-salamander", name: "Salamander", kind: "minion", hp: 999, cost: 0, speed: 7.5, range: 1.2, power: 0.5, rate: 0.3, model: "spirit-salamander", driven: true },
  "spirit-bear": { key: "spirit-bear", name: "Spirit bear", kind: "minion", hp: 999, cost: 0, speed: 4.5, range: 2.4, power: 1.4, rate: 1.4, model: "spirit-bear", driven: true },
};

/** The Summoner's beasts, by the key that calls them: its unit, how it enters, and the ritual form you beat to tame it. */
export const BEASTS = [
  { beast: "wolves", unit: "beast-wolf", ritual: null },
  { beast: "owl", unit: "beast-owl", ritual: "shadow-owl" },
  { beast: "toad", unit: "beast-toad", ritual: "shadow-toad" },
  { beast: "serpent", unit: "beast-serpent", ritual: "shadow-serpent" },
  { beast: "rabbits", unit: null, ritual: "shadow-hare" },
] as const;
/** Known from the start; the rest are tamed in this order at the ritual circle (one ritual offers the next). */
export const TAMED_AT_START = ["wolves"] as const;
export const TAME_ORDER = ["owl", "toad", "serpent", "rabbits"] as const;
export type Beast = (typeof BEASTS)[number]["beast"];
export const isBeast = (k: string): k is Beast => BEASTS.some(b => b.beast === k);
/** The next beast a ritual offers (null once all are tamed). */
export const nextToTame = (tamed: readonly string[]) => TAME_ORDER.find(b => !tamed.includes(b)) ?? null;

/**
 * Signature weapons (§1.5): one type per subclass, tiers 1–5 by TIER_BASE, all scaling with Spirit (the Druid's also
 * with Vitality). Seeded by 20261003*_classes_v2_warden_seed.sql; models by art/props-enemies/build_warden.py.
 */
const T = ["", "", "Iron-bound ", "Rune-carved ", "Gilded ", ""] as const;
const sig = (type: string, subclass: string, names: [string, string, string, string, string], scaling: WeaponDef["scaling"], basic: WeaponDef["basic"]): WeaponDef[] =>
  names.map((name, i) => ({ key: `${type}-${i + 1}`, name, type, tier: (i + 1) as WeaponDef["tier"], scaling, max_durability: 60 + (i + 1) * 30, repair_per_point: i + 1, subclass, basic }));
export const WARDEN_WEAPONS: WeaponDef[] = [
  ...sig("seal-gloves", "summoner", ["Ink seal gloves", `${T[2]}seal gloves`, `${T[3]}seal gloves`, `${T[4]}seal gloves`, "Shadow sovereign gloves"], ["spirit"], "staff"),
  ...sig("totem-staff", "shaman", ["Carved totem staff", `${T[2]}totem staff`, `${T[3]}totem staff`, `${T[4]}totem staff`, "Thunder spirit staff"], ["spirit"], "staff"),
  ...sig("living-staff", "druid", ["Living staff", `${T[2]}living staff`, `${T[3]}living staff`, `${T[4]}living staff`, "Elderbloom staff"], ["spirit", "vitality"], "staff"),
  ...sig("sunstone-staff", "priest", ["Sunstone staff", `${T[2]}sunstone staff`, `${T[3]}sunstone staff`, `${T[4]}sunstone staff`, "Dawnfire staff"], ["spirit"], "staff"),
];

/**
 * The shop's Warden weapon skins (the seed's weapon_skin rows) as material sets on each weapon's own materials, by
 * `${subclass}:${skin}` (classes.ts WEAPON_SKINS): every tier wears them; the glow part keeps its tier.
 */
export const WARDEN_SKINS: Record<string, Record<string, string>> = {
  "summoner:moonink": { M_Leather: "#1d2846", M_Cuff: "#b9c6e8" },
  "shaman:birch": { M_Wood: "#e6e0d0", M_Paint: "#2a2a2e", M_Dark: "#4a4540", M_Cloth: "#7a8a9a" },
  "shaman:aurora": { M_Wood: "#2c3440", M_Paint: "#6af0c8", M_Dark: "#1a2030", M_Cloth: "#8a7aff" },
  "druid:cherry": { M_Wood: "#4a1e22", M_Leaf: "#5a7a3a", M_Petal: "#ffb7c9" },
  "priest:dawn": { M_Wood: "#efe6da", M_Cradle: "#d8b8a0", M_Cloth: "#f6d6de" },
};

/** A rank's change on a field effect (classes.ts `upgraded`): power and heal by `power`, radii by `radius`, durations by `duration`; a channel's own effects through `inner`. */
export function scaleField(e: Effect, c: { power?: number; radius?: number; duration?: number }, inner: (x: Effect) => Effect): Effect {
  const p = c.power ?? 1, r = c.radius ?? 1, d = c.duration ?? 1;
  switch (e.kind) {
    case "ground": return { ...e, radius: e.radius * r, duration: e.duration * d, ...(e.power ? { power: e.power * p } : {}), ...(e.heal ? { heal: e.heal * p } : {}) };
    case "throw": return { ...e, power: e.power * p, radius: e.radius * r };
    case "channel": return { ...e, duration: e.duration * d, effects: e.effects.map(inner) };
    case "barrier": return { ...e, power: e.power * p, length: e.length * r, duration: e.duration * d };
    case "overcharge": return { ...e, power: e.power * p, link: e.link * p, radius: e.radius * r };
    case "awaken": case "rise": case "fade": return { ...e, duration: e.duration * d };
    default: return e;
  }
}
/** The class's stat direction on a field effect (classes.ts `withMods`): radii and lengths × area, durations × duration, heals × healing power. */
export function fieldMods(e: Effect, m: { area: number; duration: number; healing: number }, inner: (x: Effect) => Effect): Effect {
  switch (e.kind) {
    case "ground": return { ...e, radius: e.radius * m.area, duration: e.duration * m.duration, ...(e.heal ? { heal: e.heal * m.healing } : {}), ...(e.length ? { length: e.length * m.area } : {}) };
    case "throw": return { ...e, radius: e.radius * m.area };
    case "channel": return { ...e, duration: e.duration * m.duration, effects: e.effects.map(inner) };
    case "barrier": return { ...e, length: e.length * m.area, duration: e.duration * m.duration };
    case "overcharge": return { ...e, radius: e.radius * m.area };
    case "awaken": return { ...e, duration: e.duration * m.duration, ring: e.ring * m.area };
    case "rise": return { ...e, duration: e.duration * m.duration, radius: e.radius * m.area };
    case "fade": return { ...e, duration: e.duration * m.duration };
    default: return e;
  }
}
