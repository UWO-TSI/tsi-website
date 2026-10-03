/**
 * The Vanguard family (SP, yellow), classes v2 wave: the four kits exactly as David locked them
 * (specs/classes/design-sheet.md "Guardian", "Juggernaut", "Martial Artist (was Monk)", "Assassin", "Stat direction per
 * class", "Build overrides"): keys 1–5 all equipped (the Juggernaut has four), one unlock at mastery 3, the stat
 * direction raised by mastery, ranks from the §1.4 menu, class movement in the ruins only. Numbers follow the §3
 * authoring budgets and are tuned by the harness (specs/evidence/classes/K-vanguard-balance.md).
 *
 * Their signature weapons (§1.5): one type each, tiers 1–5 (the seed migration 20261002191742_classes_v2_vanguard_seed.sql).
 */
import type { ClassAbility, ClassKit } from "./classes";
import type { WeaponDef } from "./weapons";

const I = (name: string) => `/assets/game/classes/vanguard/${name}.svg`;
const RANKS = (r: ClassKit["ranks"]) => r;

// ── Guardian: armour, the parry tank; the 0.25 s parry window is the core skill ─────────────────────────────
const block: ClassAbility = {
  key: "guardian.block", name: "Block / Parry", icon: I("block"),
  description: "Hold to block frontal hits (70% less). Tap as a hit lands (0.25 s) to parry: it's negated, answered with a counter-slash, and the attacker staggers.",
  cooldown_s: 1, energy: 8, input: { kind: "hold", max_s: 3 },
  effects: [{ kind: "buff", stat: "block", value: 0.7, duration: 3 }, { kind: "buff", stat: "parry", value: 1, duration: 0.25 }],
  on_parry: [{ kind: "area", power: 1.6, radius: 2.4, at: "self", arc: 1.8, knock: 5, status: { hold: 1 } }],
  clip: { verb: "Guard" }, vfx: { cast: "guardian.block", impact: "guardian.parry" },
};
export const GUARDIAN: ClassKit = {
  key: "guardian", name: "Guardian", family: "Vanguard", role: "tank", style: "skill",
  signature: { type: "aegis", name: "shield and sword" },
  stat: { kind: "armor", at1: 0.1, at20: 0.25 },
  basic: { chain: [
    { power: 0.95, clip: "Unique_AegisCut", knock: 3 },
    { power: 0.95, clip: "Unique_AegisBackcut", knock: 3 },
    { power: 1.3, clip: "Unique_AegisThrust", time: 1.25, arc: 1.1, range: 2.1, knock: 5 },
  ] },
  keys: [
    block,
    { key: "guardian.challenge", name: "Challenge", icon: I("challenge"), description: "Bang the shield: enemies around you come for you for 4 s, and your armour rises while they do.",
      cooldown_s: 12, energy: 20, effects: [{ kind: "taunt", radius: 7, duration: 4 }, { kind: "buff", stat: "guard", value: 0.25, duration: 4 }],
      clip: { verb: "CastUp", scale: 1.3 }, vfx: { cast: "guardian.challenge" } },
    { key: "guardian.rush", name: "Shield Rush", icon: I("rush"), description: "Shield first into the line: knocks what you hit down. Slide into it to rush further; you keep the speed.",
      cooldown_s: 7, energy: 20, boost: { when: "sliding", distance: 1.6, power: 1.2 },
      effects: [{ kind: "dash", distance: 4.5, power: 1 }, { kind: "area", power: 0.6, radius: 1.8, at: "self", knock: 6, status: { hold: 0.8 } }, { kind: "momentum", speed: 3 }],
      clip: { unique: "Unique_ShieldRush" }, vfx: { cast: "guardian.rush", impact: "guardian.rushHit" } },
    { key: "guardian.dome", name: "Aegis Dome", icon: I("dome"), description: "Plant the shield: a dome that stops every shot from outside for 5 s.",
      cooldown_s: 16, energy: 30, effects: [{ kind: "summon", unit: "aegis" }], allies: 2.6,
      clip: { verb: "Plant" }, vfx: { cast: "guardian.domeCast", zone: "guardian.dome" } },
    { key: "guardian.throw", name: "Shield Throw", icon: I("throw"), description: "The shield bounces between up to 3 enemies and comes back.", unlock: 3,
      cooldown_s: 6, energy: 20, effects: [{ kind: "projectile", power: 1, speed: 18, range: 9, bounce: 2 }],
      clip: { verb: "Throw" }, vfx: { cast: "guardian.throwCast", travel: "guardian.shieldSpin", impact: "guardian.shieldHit" } },
  ],
  passive: { name: "Bulwark", description: "A perfect parry restores 20 energy and grants 30% armour for 3 s.", kind: "parry", value: 0.3, cap: 20 },
  ult: { key: "guardian.ult", name: "Unbreakable", icon: I("unbreakable"),
    description: "Plant your feet: for 6 s nothing hurts you and everything that hits you is stored. Then the shield slams down and releases it twice over as a shockwave.",
    cooldown_s: 0, energy: 0, charge: 1, anticipation_ms: 350, impacts: "first-last", duration: 6,
    effects: [{ kind: "buff", stat: "absorb", value: 1, duration: 6 }, { kind: "taunt", radius: 9, duration: 6 }, { kind: "area", power: 1.2, radius: 3, at: "self", knock: 3 }],
    release: [{ kind: "area", power: 2.5, radius: 5, at: "self", stored: 2, knock: 8, status: { hold: 1 } }],
    clip: { unique: "Ult_Guardian" }, finish: { unique: "Unique_AegisSlam" },
    vfx: { cast: "guardian.ultCast", impact: "guardian.ultImpact", zone: "guardian.ultDecal" } },
  ranks: RANKS([
    { at: 5, target: "guardian.block", change: { label: "+20% counter-slash", power: 1.2 } },
    { at: 7, target: "guardian.rush", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "guardian.challenge", change: { label: "+25% radius, longer armour", radius: 1.25, duration: 1.25 } },
    { at: 14, target: "guardian.throw", change: { label: "+20% power", power: 1.2 } },
    { at: 16, target: "passive", change: { label: "+25% armour from a parry", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ]),
  look: { ramp: ["#fffbea", "#f0c23c", "#4a3208"], mote: "shard", drift: "orbit", icon: "/assets/game/classes/guardian.svg" },
};

export const VANGUARD_KITS: ClassKit[] = [GUARDIAN];

// ── Signature weapons (§1.5): one type per subclass, tiers 1–5 (T1 wood/cloth, T2 iron, T3 rune-etched, T4 gilded with a glow part, T5 animated runes) ──
const SIG = (subclass: string, type: string, scaling: WeaponDef["scaling"], names: [string, string][]): WeaponDef[] =>
  names.map(([key, name], i) => ({ key, name, type, tier: (i + 1) as WeaponDef["tier"], scaling, max_durability: 60 + (i + 1) * 30, repair_per_point: i + 1, subclass }));
export const VANGUARD_WEAPONS: WeaponDef[] = [
  ...SIG("guardian", "aegis", ["might", "vitality"], [["aegis-oak", "Oak shield and sword"], ["aegis-iron", "Iron shield and sword"], ["aegis-rune", "Rune-etched aegis"], ["aegis-gilt", "Gilded aegis"], ["aegis-dawn", "Dawnward aegis"]]),
];
