/**
 * The Warden family's four kits (classes v2, wave "Warden"; specs/classes/design-sheet.md: Summoner, Shaman, Druid and
 * Priest LOCKED, "Stat direction per class", the Oracle map and the build overrides). Keys 1–5 all equipped; the movement
 * key opens at mastery 3 (the Summoner's keys open by taming instead); mastery raises each class's stat direction and
 * ranks its keys, the ult (10, 18) and the passive (16). Numbers are in the §1.1 units (power × base hit, fractions of max
 * HP, seconds, energy) and tuned by the v2 harness (specs/evidence/classes/K-warden-balance.md): data only.
 *
 * - Summoner (support): shadow beasts on toggles, each tamed at the ritual circle first (wolves known), each entering with
 *   its move; Escape Rabbits; Shadow Bond; Shadow Garden. Stat: summon power. Beasts out at once: 2, 3 at 10, 4 at 20.
 * - Shaman (damage): totems thrown like grenades, linked by lightning; Overcharge pays out per enemy enclosed; Spirit Hop
 *   off a post planted mid-jump; Spirit Awakening raises the thunderbird, salamander and bear. Stat: area size.
 * - Druid (tank): max HP, every heal a share of it; vines, a thorn wall, a healing bloom, a vine swing, wild ground;
 *   Overgrowth; the World Tree roots you near-unkillable. Stat: max HP.
 * - Priest (healer, solo-able): Lightbolt hurts and heals; every skill and the ult drawn (60–150%); Blessed; Divine
 *   Descent. Stat: healing power.
 *
 * FX keys name recipes in lib/game/fx/wardenFx.ts; clips are verbs on the weapon's grip or `Unique_*` / `Ult_*`
 * (art/characters/base/build_clips.py); the field primitives are in lib/combat/wardenData.ts.
 */
import type { ClassKit } from "./classes";

const I = (k: string) => `/assets/game/classes/${k}.svg`;

export const SUMMONER: ClassKit = {
  key: "summoner", name: "Summoner", family: "Warden", role: "support", style: "skill",
  signature: { type: "seal-gloves", name: "seal gloves" },
  stat: { kind: "summon_power", at1: 1, at20: 1.2 },
  keys: [
    { key: "summoner.wolves", name: "Wolves", description: "Sign the wolf: a pair of shadow wolves pounces your target, then hunts at your side. Press again to send them back.",
      cooldown_s: 1, energy: 20, input: { kind: "toggle" }, effects: [{ kind: "summon", unit: "beast-wolf", count: 2 }],
      clip: { unique: "Unique_HandSign" }, vfx: { cast: "summoner.sign", impact: "summoner.pounce" }, icon: I("summoner-wolves") },
    { key: "summoner.owl", name: "Owl", description: "The owl swoops, grabs you and glides you forward, then circles above and dives at enemies.",
      cooldown_s: 1, energy: 20, input: { kind: "toggle" }, tame: "owl", effects: [{ kind: "summon", unit: "beast-owl" }],
      clip: { unique: "Unique_HandSign" }, vfx: { cast: "summoner.sign", impact: "summoner.swoop" }, icon: I("summoner-owl") },
    { key: "summoner.toad", name: "Toad", description: "The toad's tongue drags your target to you. It stays to guard you, pulling in anything that rushes you.",
      cooldown_s: 1, energy: 25, input: { kind: "toggle" }, tame: "toad", effects: [{ kind: "summon", unit: "beast-toad" }],
      clip: { unique: "Unique_HandSign" }, vfx: { cast: "summoner.sign", impact: "summoner.tongue" }, icon: I("summoner-toad") },
    { key: "summoner.serpent", name: "Serpent", description: "The serpent bursts from the ground under your target and stuns it, then coils and bites.",
      cooldown_s: 1, energy: 25, input: { kind: "toggle" }, tame: "serpent", heavy: true, effects: [{ kind: "summon", unit: "beast-serpent" }],
      clip: { unique: "Unique_HandSign" }, vfx: { cast: "summoner.sign", impact: "summoner.burst" }, icon: I("summoner-serpent") },
    { key: "summoner.rabbits", name: "Escape Rabbits", description: "A flood of shadow rabbits pours out: you turn translucent and run faster, and what's near loses you.",
      cooldown_s: 14, energy: 20, tame: "rabbits",
      effects: [{ kind: "buff", stat: "speed", value: 0.5, duration: 3 }, { kind: "area", power: 0, radius: 4.5, at: "self", status: { distract: 1.6 } }, { kind: "fade", duration: 3, rabbits: 48 }],
      clip: { unique: "Unique_HandSign" }, vfx: { cast: "summoner.rabbits" }, icon: I("summoner-rabbits") },
  ],
  passive: { name: "Shadow Bond", description: "A fallen beast's strength passes to the others until it returns: +30% damage each.", kind: "shadow_bond", value: 0.3, cap: 2 },
  ult: { key: "summoner.ult", name: "Shadow Garden", description: "Shadow floods the ground and every tamed beast rises at once. Enemies sink; your dash warps between the shadows; then they close over everything.",
    cooldown_s: 0, energy: 0, charge: 0.88, anticipation_ms: 450, impacts: "first-last", duration: 5,
    effects: [{ kind: "area", power: 5.5, radius: 6.5, at: "self", knock: 2 }, { kind: "ground", key: "summoner.garden", at: "self", radius: 6.5, duration: 5, every: 0.5, power: 0.3, slow: 0.6, sink: true },
      { kind: "rise", duration: 5, radius: 6.5 }],
    release: [{ kind: "area", power: 7, radius: 6.5, at: "self", knock: 2, status: { hold: 1.5 } }],
    clip: { unique: "Ult_Summoner" }, vfx: { cast: "summoner.ultCharge", impact: "summoner.ultImpact", zone: "summoner.ultDecal" }, icon: I("summoner-ult") },
  ranks: [
    { at: 4, target: "summoner.wolves", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "summoner.serpent", change: { label: "+20% power", power: 1.2 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "summoner.toad", change: { label: "+20% power", power: 1.2 } },
    { at: 14, target: "summoner.owl", change: { label: "+20% power", power: 1.2 } },
    { at: 15, target: "summoner.rabbits", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#eafff1", "#3fd67a", "#0d1f17"], mote: "shadow", drift: "fall", icon: I("summoner"), passive: I("summoner-passive"), trim: { M_Leather: "#2b2140", M_Cuff: "#c9a24a" } },
  mods: { max_hp: 0.15 },
};

export const SHAMAN: ClassKit = {
  key: "shaman", name: "Shaman", family: "Warden", role: "damage", style: "skill",
  signature: { type: "totem-staff", name: "totem staff" },
  stat: { kind: "area", at1: 1, at20: 1.25 },
  keys: [
    { key: "shaman.storm", name: "Storm Totem", description: "Throw a storm totem: it plants where it lands (staggering what it hits) and zaps the nearest enemy.",
      cooldown_s: 5, energy: 20, effects: [{ kind: "throw", unit: "totem-storm", flight: 0.45, power: 0.4, hold: 0.3, radius: 1 }],
      clip: { unique: "Unique_TotemThrow" }, vfx: { cast: "shaman.throw", impact: "shaman.plant" }, icon: I("shaman-storm") },
    { key: "shaman.fire", name: "Fire Totem", description: "Throw a fire totem: it plants and bursts in flame round itself.",
      cooldown_s: 5, energy: 20, effects: [{ kind: "throw", unit: "totem-fire", flight: 0.45, power: 0.4, hold: 0.3, radius: 1 }],
      clip: { unique: "Unique_TotemThrow" }, vfx: { cast: "shaman.throw", impact: "shaman.plant" }, icon: I("shaman-fire") },
    { key: "shaman.earth", name: "Earthbind Totem", description: "Throw an earthbind totem: it slows everything round it and roots it now and then, holding them in your kill zone.",
      cooldown_s: 7, energy: 25, effects: [{ kind: "throw", unit: "totem-earth", flight: 0.45, power: 0.4, hold: 0.3, radius: 1 }],
      clip: { unique: "Unique_TotemThrow" }, vfx: { cast: "shaman.throw", impact: "shaman.plant" }, icon: I("shaman-earth") },
    { key: "shaman.overcharge", name: "Overcharge", description: "Every linked totem unloads at once. The burst grows with each enemy inside your links.",
      cooldown_s: 9, energy: 30, heavy: true, effects: [{ kind: "overcharge", radius: 2.6, power: 0.7, link: 0.5, per: 0.18, max: 2.4 }],
      clip: { verb: "Slam", scale: 1.2 }, vfx: { cast: "shaman.overcharge", impact: "shaman.unload" }, icon: I("shaman-overcharge") },
    { key: "shaman.hop", name: "Spirit Hop", description: "Mid-jump: plant a spirit post under you and jump off it. The post links with your totems for a few seconds.",
      cooldown_s: 4, energy: 15, unlock: 3, when: "airborne",
      effects: [{ kind: "throw", unit: "totem-spirit", flight: 0, power: 0, hold: 0, radius: 0, at: "self" }, { kind: "launch", height: 0.9 }, { kind: "momentum", speed: 3 }],
      clip: { verb: "Plant", scale: 1.6 }, vfx: { cast: "shaman.hop" }, icon: I("shaman-hop") },
  ],
  passive: { name: "Resonance", description: "Each link a totem holds raises its damage by 10%.", kind: "links", value: 0.1 },
  ult: { key: "shaman.ult", name: "Spirit Awakening", description: "Your totems' spirits rise: the storm's thunderbird, the fire's salamander and the earth's bear rampage through the area, then every totem erupts.",
    cooldown_s: 0, energy: 0, charge: 0.8, anticipation_ms: 500, impacts: "first-last", duration: 6,
    effects: [{ kind: "area", power: 2.5, radius: 4, at: "aim", knock: 3 }, { kind: "awaken", duration: 6, ring: 3.2 }],
    release: [{ kind: "overcharge", radius: 3.4, power: 4.2, link: 2.2, per: 0.08, max: 1.8 }],
    clip: { unique: "Ult_Shaman" }, vfx: { cast: "shaman.ultCharge", impact: "shaman.ultImpact", zone: "shaman.ultDecal" }, icon: I("shaman-ult") },
  ranks: [
    { at: 4, target: "shaman.storm", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "shaman.fire", change: { label: "+20% power", power: 1.2 } },
    { at: 9, target: "shaman.earth", change: { label: "+25% radius", radius: 1.25 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "shaman.overcharge", change: { label: "+20% power", power: 1.2 } },
    { at: 14, target: "shaman.hop", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#f0fffb", "#4fd6b8", "#0f3532"], mote: "bolt", drift: "rise", icon: I("shaman"), passive: I("shaman-passive"), trim: { M_Wood: "#3e2c22", M_Paint: "#e8c050", M_Cloth: "#2f5f8a" } },
  mods: { max_hp: 0.1 },
};

export const DRUID: ClassKit = {
  key: "druid", name: "Druid", family: "Warden", role: "tank", style: "skill",
  signature: { type: "living-staff", name: "living staff" },
  stat: { kind: "max_hp", at1: 1, at20: 1.3 },
  keys: [
    { key: "druid.snare", name: "Vine Snare", description: "Vines burst up where you aim, rooting what's there; the vines stay a few seconds, slowing and growing.",
      cooldown_s: 8, energy: 25, heavy: true,
      effects: [{ kind: "area", power: 0.85, radius: 2.6, at: "aim", status: { hold: 1.4 } }, { kind: "ground", key: "druid.vines", at: "aim", radius: 2.6, duration: 4, every: 0.5, slow: 0.3, growth: true }],
      clip: { verb: "Slam", scale: 1.3 }, vfx: { cast: "druid.cast", impact: "druid.snare" }, icon: I("druid-snare") },
    { key: "druid.wall", name: "Thorn Wall", description: "A wall of thorns across your aim: enemies can't walk or shoot through it, and touching it cuts and slows.",
      cooldown_s: 12, energy: 25, effects: [{ kind: "barrier", length: 5, duration: 6, power: 0.4, every: 0.5, slow: 0.4 }],
      clip: { verb: "Plant", scale: 1.1 }, vfx: { cast: "druid.cast", impact: "druid.wall" }, icon: I("druid-wall") },
    { key: "druid.bloom", name: "Healing Bloom", description: "A flower opens at your feet: standing in it heals 4% of your max HP a second.",
      cooldown_s: 14, energy: 30, allies: 6, effects: [{ kind: "ground", key: "druid.bloom", at: "self", radius: 2, duration: 6, every: 0.5, heal: 0.04, growth: true }],
      clip: { verb: "Channel", scale: 1.6 }, vfx: { cast: "druid.bloom" }, icon: I("druid-bloom") },
    { key: "druid.swing", name: "Vine Swing", description: "Hold: a vine to where you aim swings you toward it. Let go to fly, momentum kept.",
      cooldown_s: 7, energy: 15, unlock: 3, input: { kind: "hold", max_s: 1.2 },
      effects: [{ kind: "tether", range: 10, pull: 16 }, { kind: "launch", height: 0.45 }],
      release: [{ kind: "launch", height: 0.9 }, { kind: "momentum", speed: 4 }],
      clip: { unique: "Unique_VineSwing" }, vfx: { cast: "druid.vine" }, icon: I("druid-swing") },
    { key: "druid.wild", name: "Wild Ground", description: "The floor round you erupts in grass and roots: enemies are slowed and cut, and you regenerate.",
      cooldown_s: 16, energy: 35, effects: [{ kind: "ground", key: "druid.wild", at: "self", radius: 4.5, duration: 8, every: 1, power: 0.22, slow: 0.35, heal: 0.01, growth: true }],
      clip: { verb: "Slam", scale: 1.1 }, vfx: { cast: "druid.wild" }, icon: I("druid-wild") },
  ],
  passive: { name: "Overgrowth", description: "You regenerate 0.8% of your max HP a second, twice that while you stand in your own growth.", kind: "overgrowth", value: 0.008 },
  ult: { key: "druid.ult", name: "World Tree", description: "A giant tree grows round you and roots you: very fast regeneration and lifesteal damage to every enemy around you. It ends in a bloom.",
    cooldown_s: 0, energy: 0, charge: 0.92, anticipation_ms: 550, impacts: "first-last", duration: 7,
    effects: [{ kind: "root", duration: 7 }, { kind: "buff", stat: "guard", value: 0.4, duration: 7 }, { kind: "area", power: 2.5, radius: 6, at: "self", knock: 4, status: { hold: 0.8 } },
      { kind: "ground", key: "druid.tree", at: "self", radius: 6, duration: 7, every: 0.5, power: 0.35, drain: 0.6, heal: 0.06, growth: true }],
    release: [{ kind: "area", power: 6, radius: 6, at: "self", knock: 6 }, { kind: "heal", amount: 0.2 }],
    clip: { unique: "Ult_Druid" }, vfx: { cast: "druid.ultCharge", impact: "druid.ultImpact", zone: "druid.ultDecal" }, icon: I("druid-ult") },
  ranks: [
    { at: 4, target: "druid.snare", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "druid.bloom", change: { label: "+20% healing", power: 1.2 } },
    { at: 9, target: "druid.wall", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "druid.wild", change: { label: "+25% radius", radius: 1.25 } },
    { at: 14, target: "druid.swing", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#f4ffe2", "#7fcc4f", "#1d3a12"], mote: "leaf", drift: "fall", icon: I("druid"), passive: I("druid-passive"), trim: { M_Wood: "#5a3b26", M_Leaf: "#9be06a", M_Petal: "#f6f0c0" } },
  mods: { max_hp: 0.3 },
};

export const PRIEST: ClassKit = {
  key: "priest", name: "Priest", family: "Warden", role: "healer", style: "skill",
  signature: { type: "sunstone-staff", name: "sunstone staff" },
  stat: { kind: "healing", at1: 1, at20: 1.3 },
  basicHeal: 0.012,
  keys: [
    { key: "priest.mend", name: "Mend", description: "Draw the cross: a big heal on you, or the ally under your crosshair.",
      cooldown_s: 8, energy: 25, allies: 8, input: { kind: "drawn", shape: "cross" }, effects: [{ kind: "heal", amount: 0.28 }],
      clip: { verb: "CastUp", scale: 1.3 }, vfx: { cast: "priest.mend" }, icon: I("priest-mend") },
    { key: "priest.shield", name: "Radiant Shield", description: "Draw the circle: a strong shield of light on you or an ally.",
      cooldown_s: 12, energy: 25, allies: 8, input: { kind: "drawn", shape: "circle" }, effects: [{ kind: "shield", amount: 0.32, duration: 6 }],
      clip: { verb: "Guard", scale: 1.2 }, vfx: { cast: "priest.shield" }, icon: I("priest-shield") },
    { key: "priest.beam", name: "Holy Beam", description: "Draw the line the way the beam goes: a channelled beam that burns enemies and heals you and the allies it passes.",
      cooldown_s: 7, energy: 25, input: { kind: "drawn", shape: "line" },
      effects: [{ kind: "channel", duration: 1.8, every: 0.3, effects: [{ kind: "area", power: 0.48, radius: 0.6, at: "self", length: 9 }, { kind: "heal", amount: 0.012 }] }],
      clip: { verb: "Channel", scale: 1 }, vfx: { cast: "priest.beamCast", impact: "priest.beam" }, icon: I("priest-beam") },
    { key: "priest.sanctify", name: "Sanctify", description: "Draw the triangle: a holy circle where you aim burns enemies inside and heals you while you stand in it.",
      cooldown_s: 12, energy: 30, heavy: true, input: { kind: "drawn", shape: "triangle" },
      effects: [{ kind: "area", power: 0.8, radius: 3.2, at: "aim", knock: 2 }, { kind: "ground", key: "priest.sanctum", at: "aim", radius: 3.2, duration: 6, every: 1, power: 0.45, heal: 0.025 }],
      clip: { verb: "Slam", scale: 1.2 }, vfx: { cast: "priest.cast", impact: "priest.sanctify" }, icon: I("priest-sanctify") },
    { key: "priest.step", name: "Light Step", description: "Draw the chevron pointing the way: a holy dash that keeps your momentum and leaves a healing trail.",
      cooldown_s: 8, energy: 20, unlock: 3, input: { kind: "drawn", shape: "chevron" },
      effects: [{ kind: "momentum", speed: 3 }, { kind: "dash", distance: 5 }, { kind: "ground", key: "priest.trail", at: "path", length: 5, radius: 0.9, duration: 3, every: 0.5, heal: 0.03 }],
      clip: { verb: "Backstep", scale: 0.8 }, vfx: { cast: "priest.step" }, icon: I("priest-step") },
  ],
  passive: { name: "Blessed", description: "You regenerate 1% of your max HP a second, and healing past full becomes a shield.", kind: "blessed", value: 0.01, cap: 0.3 },
  ult: { key: "priest.ult", name: "Divine Descent", description: "Draw the winged sigil: wings of light, and a pillar slams down where you aim. You're healed full, allies too (the downed rise), and enemies burn.",
    cooldown_s: 0, energy: 0, charge: 1, anticipation_ms: 500, impacts: "first", input: { kind: "drawn", shape: "wings" },
    effects: [{ kind: "area", power: 7.5, radius: 5, at: "aim", knock: 5 }, { kind: "heal", amount: 1 },
      { kind: "ground", key: "priest.pillar", at: "aim", radius: 5, duration: 3, every: 0.5, power: 0.45, heal: 0.03 }],
    clip: { unique: "Ult_Priest" }, vfx: { cast: "priest.ultCharge", impact: "priest.ultImpact", zone: "priest.ultDecal" }, icon: I("priest-ult") },
  ranks: [
    { at: 4, target: "priest.mend", change: { label: "+20% healing", power: 1.2 } },
    { at: 7, target: "priest.beam", change: { label: "+20% power", power: 1.2 } },
    { at: 9, target: "priest.shield", change: { label: "+20% shield", power: 1.2 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 12, target: "priest.sanctify", change: { label: "+25% radius", radius: 1.25 } },
    { at: 14, target: "priest.step", change: { label: "−20% cooldown", cooldown: 0.8 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#fffbe6", "#d2dc66", "#3e4413"], mote: "sun", drift: "rise", icon: I("priest"), passive: I("priest-passive"), trim: { M_Wood: "#f4ecdc", M_Cradle: "#e2b84a", M_Cloth: "#fff8e8" } },
  mods: { max_hp: 0.15 },
};

export const WARDEN_KITS: ClassKit[] = [SUMMONER, SHAMAN, DRUID, PRIEST];
