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

// ── Juggernaut: max HP, basic attacks, the unstoppable war hammer, Titan ───────────────────────────────────
export const JUGGERNAUT: ClassKit = {
  key: "juggernaut", name: "Juggernaut", family: "Vanguard", role: "tank", style: "basic",
  signature: { type: "warhammer", name: "war hammer" },
  stat: { kind: "max_hp", at1: 1.2, at20: 1.5 },
  basic: { hp: 0.02, reset: 1.6, chain: [
    { power: 1.25, clip: "Unique_HammerSwing", knock: 5 },
    { power: 1.45, clip: "Unique_HammerOverhead", time: 1.15, arc: 1.4, range: 2.4, knock: 7 },
  ] },
  keys: [
    { key: "juggernaut.charge", name: "Charge", icon: I("charge"), description: "A bull rush that plows through everything in its path. Slide into it to go further.",
      cooldown_s: 8, energy: 25, boost: { when: "sliding", distance: 1.5, power: 1.2 },
      effects: [{ kind: "dash", distance: 6, power: 1.3 }, { kind: "momentum", speed: 3 }],
      clip: { unique: "Unique_Charge" }, vfx: { cast: "juggernaut.charge", impact: "juggernaut.chargeHit" } },
    { key: "juggernaut.slam", name: "Ground Slam", icon: I("slam"), description: "Crack the ground: everything around you is stunned.", heavy: true,
      cooldown_s: 10, energy: 30, effects: [{ kind: "area", power: 1.9, radius: 3.2, at: "self", knock: 4, status: { hold: 1.2 } }],
      clip: { verb: "Slam", scale: 1.1 }, vfx: { cast: "juggernaut.slamCast", impact: "juggernaut.slam", zone: "juggernaut.crack" } },
    { key: "juggernaut.warcry", name: "War Cry", icon: I("warcry"), description: "Roar: enemies come for you, and you gain 20% of your max HP as temporary health for 8 s.",
      cooldown_s: 16, energy: 20, allies: 6, effects: [{ kind: "taunt", radius: 8, duration: 5 }, { kind: "shield", amount: 0.2, duration: 8 }],
      clip: { unique: "Unique_WarCry" }, vfx: { cast: "juggernaut.warcry" } },
    { key: "juggernaut.drop", name: "Seismic Drop", icon: I("drop"), description: "In the air: crash down. The higher you fall from, the harder it lands (up to +150% from 3 u).",
      unlock: 3, heavy: true, when: "airborne", scale: { by: "height", max: 1.5 },
      cooldown_s: 6, energy: 20, effects: [{ kind: "drop" }, { kind: "after", delay: 0.12, effects: [{ kind: "area", power: 1.6, radius: 2.8, at: "self", knock: 5, status: { hold: 0.6 } }] }],
      clip: { unique: "Unique_SeismicDrop" }, vfx: { impact: "juggernaut.quake", zone: "juggernaut.crack" } },
  ],
  passive: { name: "Unstoppable", description: "Nothing knocks you back or interrupts you while you attack. Every hammer hit adds 2% of your max HP as damage.", kind: "unstoppable", value: 1 },
  ult: { key: "juggernaut.ult", name: "Titan", icon: I("titan"),
    description: "Grow to 2.5× for 10 s: your reach grows, every swing sends a shockwave, and the ground shakes as you walk. It ends with the hammer splitting the earth.",
    cooldown_s: 0, energy: 0, charge: 1, anticipation_ms: 500, impacts: "first-last", duration: 10,
    effects: [{ kind: "buff", stat: "size", value: 1.5, duration: 10, swing: [{ kind: "area", power: 0.8, radius: 4, at: "self", arc: 2.2, knock: 5 }] },
      { kind: "buff", stat: "guard", value: 0.3, duration: 10 }, { kind: "area", power: 2, radius: 4, at: "self", knock: 6 }],
    release: [{ kind: "area", power: 6, radius: 1.5, at: "self", length: 9, knock: 9, status: { hold: 1 } }],
    clip: { verb: "CastUp", scale: 0.8 }, finish: { unique: "Ult_Juggernaut" },
    vfx: { cast: "juggernaut.ultCast", impact: "juggernaut.ultImpact", zone: "juggernaut.ultShock" } },
  ranks: RANKS([
    { at: 5, target: "juggernaut.slam", change: { label: "+25% radius", radius: 1.25 } },
    { at: 7, target: "juggernaut.charge", change: { label: "+20% power", power: 1.2 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "juggernaut.warcry", change: { label: "+20% temporary health", power: 1.2 } },
    { at: 14, target: "juggernaut.drop", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ]),
  look: { ramp: ["#fff3dc", "#e8a23a", "#4a2408"], mote: "debris", drift: "fall", icon: "/assets/game/classes/juggernaut.svg" },
};

// ── Martial Artist (key `monk`): attack speed, realistic Muay Thai; skills are techniques woven into the chain ──
const strike = (power: number, more: Partial<Extract<ClassAbility["effects"][number], { kind: "strike" }>> = {}) => ({ kind: "strike" as const, power, range: 1.7, knock: 1.5, ...more });
export const MARTIAL_ARTIST: ClassKit = {
  key: "monk", name: "Martial Artist", family: "Vanguard", role: "damage", style: "basic",
  signature: { type: "handwraps", name: "hand wraps" },
  stat: { kind: "attack_speed", at1: 1, at20: 1.3 },
  basic: { reset: 1, chain: [
    { power: 0.6, clip: "Unique_Jab", time: 0.8, arc: 1.2, knock: 1 },
    { power: 0.8, clip: "Unique_Cross", time: 0.9, arc: 1.2, knock: 1.5 },
    { power: 0.95, clip: "Unique_Hook", arc: 1.8, knock: 2 },
    { power: 1.35, clip: "Unique_BodyKick", time: 1.3, arc: 2, range: 1.7, knock: 4 },
  ] },
  keys: [
    { key: "monk.teep", name: "Teep", icon: I("teep"), description: "A push kick: shoves the target back and makes space. Stronger slotted into the chain.",
      cooldown_s: 4, energy: 15, chain: { bonus: 0.4 }, effects: [strike(1.1, { range: 1.9, knock: 9, status: { hold: 0.3 } })],
      clip: { unique: "Unique_Teep" }, vfx: { impact: "monk.teep" } },
    { key: "monk.elbow", name: "Elbow", icon: I("elbow"), description: "A slashing elbow: a big hit and a cut that bleeds for 3 s. Stronger slotted into the chain.", heavy: true,
      cooldown_s: 6, energy: 20, chain: { bonus: 0.5 },
      effects: [strike(1.9, { range: 1.5, knock: 3 }), ...[1, 2, 3].map(t => ({ kind: "after" as const, delay: t, fx: "monk.cut", tier: "light" as const, effects: [strike(0.25, { knock: 0 })] }))],
      clip: { unique: "Unique_Elbow" }, vfx: { impact: "monk.elbow" } },
    { key: "monk.clinch", name: "Clinch Knees", icon: I("clinch"), description: "Grab the target and knee it three times; it's stunned and can't move for the whole technique.",
      cooldown_s: 9, energy: 25, chain: { bonus: 0.4 },
      effects: [strike(0.1, { range: 1.6, knock: 0, status: { hold: 1.4 } }),
        { kind: "after", delay: 0.3, effects: [strike(0.75, { knock: 0.2 })] }, { kind: "after", delay: 0.7, effects: [strike(0.75, { knock: 0.2 })] },
        { kind: "after", delay: 1.1, tier: "heavy", effects: [strike(0.95, { knock: 5 })] }],
      clip: { unique: "Unique_ClinchKnees" }, vfx: { impact: "monk.knee" } },
    { key: "monk.roundhouse", name: "Roundhouse", icon: I("roundhouse"), description: "A shin kick across a wide arc in front. Stronger slotted into the chain.",
      cooldown_s: 5, energy: 20, chain: { bonus: 0.4 }, effects: [{ kind: "area", power: 1.3, radius: 2.3, at: "self", arc: 3, knock: 5 }],
      clip: { unique: "Unique_Roundhouse" }, vfx: { impact: "monk.roundhouse" } },
    { key: "monk.knee", name: "Flying Knee", icon: I("flyingknee"), description: "From a run, a slide or a dash: a leaping knee that keeps your momentum and starts a chain.",
      unlock: 3, when: "moving", cooldown_s: 7, energy: 20, chain: { bonus: 0.3 },
      effects: [{ kind: "launch", height: 0.5 }, { kind: "dash", distance: 4, power: 1.6 }, { kind: "momentum", speed: 3 }],
      clip: { unique: "Unique_FlyingKnee" }, vfx: { cast: "monk.leap", impact: "monk.knee" } },
  ],
  passive: { name: "Rhythm", description: "Each hit in a chain adds 8% attack speed, up to +40%; a 1 s gap resets it.", kind: "rhythm", value: 0.08, cap: 5 },
  ult: { key: "monk.ult", name: "Art of Eight Limbs", icon: I("eightlimbs"),
    description: "Lock onto one enemy for eight strikes (fists, elbows, knees, shins), each its own impact; the final roundhouse lands with a shockwave.",
    cooldown_s: 0, energy: 0, charge: 1, anticipation_ms: 400, impacts: "first-last", duration: 2.4,
    effects: [strike(1.4, { range: 2.6, arc: 3, knock: 0, status: { hold: 3 } }),
      ...[[0.28, 1.4], [0.56, 1.5], [0.84, 1.5], [1.12, 1.6], [1.4, 1.6], [1.72, 1.8]].map(([t, pw]) => ({ kind: "after" as const, delay: t, tier: "heavy" as const, fx: "monk.ultHit", effects: [strike(pw, { knock: 0.3 })] }))],
    release: [strike(3.5, { range: 3, knock: 10 }), { kind: "area", power: 1.5, radius: 3.5, at: "self", knock: 6 }],
    clip: { unique: "Ult_MartialArtist" }, vfx: { cast: "monk.ultCast", impact: "monk.ultImpact", zone: "monk.ultShock" } },
  ranks: RANKS([
    { at: 5, target: "monk.teep", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "monk.clinch", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "monk.elbow", change: { label: "+20% power and cut", power: 1.2 } },
    { at: 14, target: "monk.roundhouse", change: { label: "+25% arc reach", radius: 1.25 } },
    { at: 16, target: "passive", change: { label: "+25% attack speed per hit", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ]),
  look: { ramp: ["#fff6e8", "#f2913a", "#5a1e08"], mote: "flare", drift: "rise", icon: "/assets/game/classes/martial-artist.svg" },
};

export const VANGUARD_KITS: ClassKit[] = [GUARDIAN, JUGGERNAUT, MARTIAL_ARTIST];

// ── Signature weapons (§1.5): one type per subclass, tiers 1–5 (T1 wood/cloth, T2 iron, T3 rune-etched, T4 gilded with a glow part, T5 animated runes) ──
const SIG = (subclass: string, type: string, scaling: WeaponDef["scaling"], names: [string, string][]): WeaponDef[] =>
  names.map(([key, name], i) => ({ key, name, type, tier: (i + 1) as WeaponDef["tier"], scaling, max_durability: 60 + (i + 1) * 30, repair_per_point: i + 1, subclass }));
export const VANGUARD_WEAPONS: WeaponDef[] = [
  ...SIG("guardian", "aegis", ["might", "vitality"], [["aegis-oak", "Oak shield and sword"], ["aegis-iron", "Iron shield and sword"], ["aegis-rune", "Rune-etched aegis"], ["aegis-gilt", "Gilded aegis"], ["aegis-dawn", "Dawnward aegis"]]),
  ...SIG("juggernaut", "warhammer", ["might", "vitality"], [["warhammer-timber", "Timber war hammer"], ["warhammer-iron", "Iron war hammer"], ["warhammer-rune", "Rune-etched war hammer"], ["warhammer-gilt", "Gilded war hammer"], ["warhammer-quake", "Quakeborn war hammer"]]),
  ...SIG("monk", "handwraps", ["might", "finesse"], [["handwraps-cotton", "Cotton fight wraps"], ["handwraps-iron", "Iron-knuckle wraps"], ["handwraps-rune", "Rune-stitched wraps"], ["handwraps-gilt", "Gilded wraps"], ["handwraps-sun", "Sunfire wraps"]]),
];
