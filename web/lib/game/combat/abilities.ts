/**
 * The one ability system (combat content B): runs the kits in
 * web/lib/combat/kits.ts for all sixteen subclasses. An ability is a list of
 * shared effect primitives (projectile, area, dash, shield, heal, summon,
 * buff, transform); every hit, from a weapon, an ability or a summon, goes
 * through `strike`, where the passives read and write their few numbers.
 * Summons, totems, traps and decoys are `rt.units`, capped per kind (row 50).
 * Incantation abilities open the rune overlay; the world keeps running and a
 * dodge cancels (rows 52, 53, C3). Pure over the runtime, no three.js.
 */
import { CAPS, FAMILY_STAT, UNITS, minionFor, resolveLoadout, TRAITS, traitTier, type Ability, type Effect, type Element, type Status, type Subclass } from "@/lib/combat/kits";
import { derived, type Stat } from "@/lib/combat/progression";
import { damage as ruleDamage, WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import type { IncantationScore } from "./contract";
import { ENEMIES } from "./data";
import { advanceMission, type MissionEvent } from "./missions";
import { angleDiff, BOSS, damageEnemy, facingTo, inArc, segDist, spawnEnemy, staggered, type Enemy, type Vec } from "./sim";
import { SLOT_IDS, type Buff, type CombatRuntime, type CueKind, type FxEvent, type ImpactTier, type ShotHit, type Unit } from "./runtime";
import { addKick } from "./moveHooks";
import { addCharge, dealtCharge, healedCharge } from "@/lib/combat/ult";

/** Plan §Combat and incantation defaults: starting a drawing spends 25% of its energy, a fizzle or cancel costs a short recovery instead of the cooldown. */
export const CAST = { start: 0.25, recovery: 1.5 } as const;
export const DASH_SPEED = 18;
/** Potency caps (plan): damage takes the full 0.5–1.5, shields and heals at most 1.2, control never more than 1. */
const SUPPORT_CAP = 1.2, CONTROL_CAP = 1;
const AIM_RANGE = 12, GUARD_CAP = 0.6, SHIELD_CAP = 0.6;
const ELEMENTS: Element[] = ["fire", "frost", "lightning"];
const COLOR = { fire: "#ff8a3d", frost: "#8fd8ff", lightning: "#ffe36e", Arcane: "#b48cff", Ranger: "#8fd0ff", Vanguard: "#ffd27a", Warden: "#8fe39a", heal: "#9dffb0", shield: "#bfe3ff" } as const;
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** Damage numbers and status words ("Dodged", "Not enough energy") keep separate pools, so a flurry of hits never pushes a status out. */
export const FLOATERS = { damage: 12, info: 4 } as const;
export function floater(rt: CombatRuntime, at: Vec, y: number, text: string, kind: "hit" | "crit" | "hurt" | "info") {
  rt.floaters.push({ id: rt.seq++, x: at.x, y, z: at.z, text, kind, age: 0 });
  const info = kind === "info";
  let n = 0;
  for (const f of rt.floaters) if ((f.kind === "info") === info) n++;
  if (n > (info ? FLOATERS.info : FLOATERS.damage)) rt.floaters.splice(rt.floaters.findIndex(f => (f.kind === "info") === info), 1);
}
/** A cue for the scene (sound, hitstop, shake, puff); at most 32 wait, for runs nobody drains (the balance harness). */
export function cue(rt: CombatRuntime, kind: CueKind, at: Vec, melee = false, tier?: ImpactTier, first?: boolean) {
  rt.cues.push({ kind, x: at.x, z: at.z, melee, tier, first });
  if (rt.cues.length > 32) rt.cues.shift();
}
/** An FX event for the renderer (classes v2): seeded from the place and the runtime's sequence, so every client draws the same; at most 64 wait. */
export function fx(rt: CombatRuntime, key: string | undefined, phase: FxEvent["phase"], at: Vec, aim: Vec, tier: ImpactTier, radius?: number) {
  if (!key || !rt.v2) return;
  rt.fx.push({ caster: "me", key, phase, x: at.x, z: at.z, aim: { x: aim.x, z: aim.z }, seed: (rt.seq++ * 2654435761) >>> 0, tier, ramp: rt.v2.kit.look.ramp, radius });
  if (rt.fx.length > 64) rt.fx.shift();
}
/** Classes v2: points on the ult meter (§1.2), never while an ult is under way for its own hits (the caller says). */
export function chargeUlt(rt: CombatRuntime, points: number) {
  const v = rt.v2;
  if (v && points > 0) v.meter = addCharge(v.meter, points * v.ult.charge);
}
export function missionEvent(rt: CombatRuntime, ev: MissionEvent) {
  if (rt.mission) rt.mission = advanceMission(rt.mission, ev);
}
export function spend(rt: CombatRuntime, energy: number): boolean {
  const p = rt.player;
  if (p.energy < energy) return false;
  p.energy -= energy; p.sinceSpend = 0;
  return true;
}

// ── Kit ─────────────────────────────────────────────────────────
/** Equip the member's kit and loadout (from /api/combat/progression). Units whose ability left the loadout are dismissed (row 50). */
export function equipKit(rt: CombatRuntime, subclass: Subclass | null, loadout: string[] = [], traits: Record<string, number> = {}) {
  const abilities = subclass ? resolveLoadout(subclass, loadout, traits) : [];
  rt.kit = subclass ? { subclass, capacity: derived(rt.player.stats, rt.player.level, subclass.mods).summon_capacity, traits } : null;
  rt.slots = SLOT_IDS.map((_, i) => abilities[i] ?? null);
  const kept = new Set(abilities.map(a => a.key));
  rt.units = rt.units.filter(u => u.source === "weapon" || kept.has(u.source));
}
const passiveOf = (rt: CombatRuntime) => rt.kit?.subclass.passive ?? rt.v2?.passive ?? null;
/** Summon capacity: today's kit's, or a v2 class's (its stat direction may add). */
const capacityOf = (rt: CombatRuntime) => rt.kit?.capacity ?? rt.v2?.capacity ?? 2;
export const buffSum = (rt: CombatRuntime, stat: Buff["stat"]) => rt.buffs.reduce((n, b) => n + (b.stat === stat && b.t > 0 ? b.value : 0), 0);
export const critChance = (rt: CombatRuntime) => derived(rt.player.stats, rt.player.level).crit_chance + buffSum(rt, "crit") + (rt.v2?.mods.critChance ?? 0);
/** Speed multiplier: stats and kit (the Assassin), buffs, Monk momentum. */
/** derived()'s move speed for the last stats, level and kit mods seen (the encounter asks every frame; they change rarely). */
let base: { stats: object; level: number; mods: object | undefined; speed: number } | null = null;
export function moveSpeed(rt: CombatRuntime): number {
  const pv = passiveOf(rt), p = rt.player, mods = rt.kit?.subclass.mods;
  if (!base || base.stats !== p.stats || base.level !== p.level || base.mods !== mods) base = { stats: p.stats, level: p.level, mods, speed: derived(p.stats, p.level, mods).move_speed };
  return base.speed * (1 + buffSum(rt, "speed") + (pv?.kind === "momentum" ? pv.value * rt.passive.momentum : 0));
}
export const distracted = (rt: CombatRuntime, e: Enemy) => e.status.distract > 0 || e.status.hold > 0 || rt.units.some(u => u.def.kind === "decoy" && dist(u, e) < e.type.aggroRadius + 3);

// ── Hits ────────────────────────────────────────────────────────
/** `melee`: a weapon swing (its hits stop time for a beat). `impact`: its impact tier (§1.6); `ult`: an ult hit (charges no meter). */
export interface HitSrc { power: number; from: Vec; stat?: Stat; tier?: number; unit?: boolean; knock?: number; status?: Status; melee?: boolean; impact?: ImpactTier; ult?: boolean; first?: boolean }

/** The passive's damage bonus for this hit (a fraction). */
function passiveBonus(rt: CombatRuntime, e: Enemy, src: HitSrc): number {
  const pv = passiveOf(rt), me = rt.player.last;
  if (!pv) return 0;
  if (src.unit) return pv.kind === "pack_bond" ? pv.value * Math.max(0, rt.units.filter(u => u.def.kind === "minion" && u.source !== "weapon").length - 1) : 0;
  switch (pv.kind) {
    case "distracted": return distracted(rt, e) ? pv.value : 0;
    case "still": return rt.player.still >= 0.8 ? pv.value : 0;
    case "same_target": return rt.passive.target === e.id ? pv.value * rt.passive.stacks : 0;
    case "distance": return me ? pv.value * Math.min(1, dist(me, e) / (pv.cap ?? 12)) : 0;
    default: return 0;
  }
}

/** What a hit would deal: the systems damage rule on the equipped weapon (or a trait's tier), scaled by the ability's stat, buffs, passive, mark and stagger. */
export function hitAmount(rt: CombatRuntime, e: Enemy, src: HitSrc, random: () => number = Math.random): { amount: number; crit: boolean; raw: number; base: number } {
  const p = rt.player, def = SYSTEM_WEAPONS.find(w => w.key === p.weapon)!;
  const weapon = src.stat || src.tier ? { ...def, scaling: src.stat ? [src.stat] : def.scaling, tier: (src.tier ?? def.tier) as typeof def.tier } : def;
  const crit = random() < critChance(rt), critMult = rt.v2?.mods.critMult;
  const mult = src.power * (staggered(e) ? BOSS.staggerBonus : 1) * (1 + buffSum(rt, "damage") + passiveBonus(rt, e, src) + e.status.mark);
  const hit = { weapon, durability: src.tier ? 1 : p.durability[p.weapon], stats: p.stats, level: p.level, enemyDefense: e.type.defense, enemyArmor: e.type.armor, crit, critMult, potency: mult };
  // Classes v2 meter (§1.2): the hit before defense and armour, over your own base hit (the weapon at potency 1).
  const raw = rt.v2 ? ruleDamage({ ...hit, enemyDefense: 0, enemyArmor: 0 }) : 0, base = rt.v2 ? ruleDamage({ ...hit, enemyDefense: 0, enemyArmor: 0, crit: false, potency: 1 }) : 0;
  return { amount: ruleDamage(hit), crit, raw, base };
}

/** One hit on an enemy from anything the player owns: damage, statuses, passives, kill bookkeeping. Returns the damage dealt. */
export function strike(rt: CombatRuntime, e: Enemy, src: HitSrc, random: () => number = Math.random): number {
  if (e.state === "dead" || e.state === "return") return 0;
  const { amount, crit, raw, base } = hitAmount(rt, e, src, random);
  const held = e.status.hold > 0;
  const killed = damageEnemy(e, amount, src.from, src.knock ?? 0);
  if (e.flash === 0.18) floater(rt, e, 1.4 + e.type.hover, String(amount), crit ? "crit" : "hit");
  if (src.status && !killed) applyStatus(e, src.status);
  if (!src.ult) chargeUlt(rt, dealtCharge(raw, base)); // you and your units; ult hits charge nothing
  if (!src.unit) { onPlayerHit(rt, e, amount, crit, held); cue(rt, crit ? "crit" : "hit", e, !!src.melee, src.impact, src.first); }
  if (killed) onKill(rt, e);
  return amount;
}

function onPlayerHit(rt: CombatRuntime, e: Enemy, amount: number, crit: boolean, held: boolean) {
  const pv = passiveOf(rt), s = rt.passive;
  if (!pv) return;
  if (pv.kind === "lifesteal") heal(rt, amount * pv.value * (held ? 2 : 1));
  if (pv.kind === "same_target") { if (s.target === e.id) s.stacks = Math.min(pv.cap ?? 5, s.stacks + 1); else { s.target = e.id; s.stacks = 1; } }
  if (pv.kind === "momentum") { s.momentum = Math.min(pv.cap ?? 5, s.momentum + 1); s.momentumT = 2; }
  if (pv.kind === "crit_cdr" && crit && s.procs < (pv.cap ?? 3)) {
    const i = rt.slots.findIndex(a => a?.key === rt.kit?.subclass.signature.key);
    if (i >= 0 && rt.cooldowns[SLOT_IDS[i]] > 0) { rt.cooldowns[SLOT_IDS[i]] = Math.max(0, rt.cooldowns[SLOT_IDS[i]] - pv.value); s.procs++; }
  }
}

function onKill(rt: CombatRuntime, e: Enemy) {
  rt.killQueue.push({ enemy: e.type.id, key: `kill:${e.id}:${rt.seq++}:${Date.now().toString(36)}` });
  cue(rt, e.type.kind === "boss" ? "bossDefeat" : "defeat", e);
  missionEvent(rt, { type: "kill", enemy: e.type.id });
  const pv = passiveOf(rt), me = rt.player.last;
  if (pv?.kind === "kill_heal" && me && dist(me, e) <= (pv.cap ?? 9)) heal(rt, rt.player.maxHp * pv.value);
}

/** Bosses shrug off most control, elites some (row 51: the boss is a wall). */
const resist = (e: Enemy) => (e.type.kind === "boss" ? 0.3 : e.type.elite ? 0.6 : 1);
export function applyStatus(e: Enemy, st: Status, ctl = 1) {
  const s = e.status, r = resist(e);
  if (st.hold) s.hold = Math.max(s.hold, st.hold * ctl * r);
  if (st.slow) { s.slow = Math.max(s.slow, st.slow[0] * (e.type.kind === "boss" ? 0.5 : 1)); s.slowFor = Math.max(s.slowFor, st.slow[1] * ctl); }
  if (st.mark) { s.mark = Math.max(s.mark, st.mark[0]); s.markFor = Math.max(s.markFor, st.mark[1]); }
  if (st.distract) s.distract = Math.max(s.distract, st.distract * ctl * r);
}

// ── Self: heal, shield, buffs ───────────────────────────────────
/** Heal; past full, the Priest's Sanctuary turns the rest into a shield. Returns the health restored. */
export function heal(rt: CombatRuntime, amount: number): number {
  const p = rt.player;
  if (!p.alive || amount <= 0) return 0;
  const gained = Math.min(amount, p.maxHp - p.hp);
  p.hp += gained;
  chargeUlt(rt, healedCharge(gained, p.maxHp)); // health actually restored (overheal charges nothing)
  const pv = passiveOf(rt);
  if (pv?.kind === "overheal_shield" && amount > gained) addShield(rt, Math.min((amount - gained) * pv.value, p.maxHp * (pv.cap ?? 0.3) - p.shield), 6);
  return gained;
}
export function addShield(rt: CombatRuntime, amount: number, duration: number) {
  const p = rt.player;
  if (amount <= 0) return;
  p.shield = Math.min(p.maxHp * SHIELD_CAP, p.shield + amount);
  p.shieldFor = Math.max(p.shieldFor, duration);
}
export function addBuff(rt: CombatRuntime, b: Buff) {
  rt.buffs = rt.buffs.filter(x => !(x.stat === b.stat && x.onBlock === b.onBlock && b.onBlock)); // re-raising a guard refreshes it
  rt.buffs.push(b);
}

/** Damage to the player after guard, a frontal block and the shield. Returns what's left for health; triggers block passives/answers. */
export function mitigate(rt: CombatRuntime, amount: number, from: Vec, me: Vec, random: () => number = Math.random): { damage: number; blocked: boolean } {
  const p = rt.player;
  let dmg = amount * (1 - Math.min(GUARD_CAP, buffSum(rt, "guard") + (rt.v2?.mods.guard ?? 0)));
  const block = rt.buffs.find(b => b.stat === "block" && b.t > 0);
  const frontal = angleDiff(facingTo(me, from), p.facing) < 1.1;
  let blocked = false;
  if (block && frontal) {
    blocked = true;
    dmg *= 1 - block.value;
    floater(rt, me, 1.9, "Blocked", "info");
    const pv = passiveOf(rt);
    if (pv?.kind === "block_shield") addShield(rt, p.maxHp * pv.value, 5);
    if (block.onBlock?.on_block && !block.answered) { block.answered = true; runEffects(rt, block.onBlock.on_block, context(rt, block.onBlock, me, 1, from), random); }
  }
  const soak = Math.min(p.shield, dmg);
  p.shield -= soak;
  chargeUlt(rt, healedCharge(soak, p.maxHp)); // shield that actually absorbed
  return { damage: Math.round(dmg - soak), blocked };
}

// ── Using a slot ────────────────────────────────────────────────
/** `impact`: the tier its hits land with; `ult`: the ult's own hits (no meter); `fx`: the ability's FX registry keys (classes v2). */
export interface Ctx { ability: Ability; pos: Vec; aim: Vec; dir: Vec; dmg: number; sup: number; ctl: number; gear: number; stat: Stat; tier?: number; color: string;
  impact?: ImpactTier; ult?: boolean; fx?: { cast?: string; travel?: string; impact?: string; zone?: string } }

export function context(rt: CombatRuntime, ability: Ability, me: Vec, potency: number, aimAt: Vec): Ctx {
  const p = rt.player, sub = rt.kit?.subclass, family = sub?.family ?? rt.v2?.kit.family ?? "Vanguard";
  const d = Math.hypot(aimAt.x - me.x, aimAt.z - me.z);
  const dir = d > 0.05 ? { x: (aimAt.x - me.x) / d, z: (aimAt.z - me.z) / d } : { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  const aim = d > AIM_RANGE ? { x: me.x + dir.x * AIM_RANGE, z: me.z + dir.z * AIM_RANGE } : { ...aimAt };
  const type = SYSTEM_WEAPONS.find(w => w.key === p.weapon)?.type;
  const gear = ability.gear && type !== ability.gear.type ? ability.gear.without : 1;
  // Elemental Rhythm: a different element than the last strengthens this cast.
  let elementBonus = 0;
  if (ability.element) {
    const el = ability.element === "cycle" ? ELEMENTS[(ELEMENTS.indexOf(rt.passive.element ?? "lightning") + 1) % 3] : ability.element;
    const pv = passiveOf(rt);
    if (pv?.kind === "element_switch" && rt.passive.element && rt.passive.element !== el) elementBonus = pv.value;
    rt.passive.element = el;
  }
  const trait = TRAITS.find(t => t.ability.key === ability.key);
  return {
    ability, pos: { ...me }, aim, dir, gear,
    dmg: potency * gear * (1 + elementBonus), sup: Math.min(potency, SUPPORT_CAP), ctl: Math.min(potency, CONTROL_CAP),
    stat: ability.stat ?? FAMILY_STAT[family], tier: trait ? traitTier(rt.kit?.traits[trait.key] ?? 0) : undefined,
    color: ability.element ? COLOR[rt.passive.element ?? "fire"] : rt.v2 ? rt.v2.kit.look.ramp[1] : COLOR[family],
  };
}

/** Ability keys 1–4. Drawn abilities open the rune overlay (25% energy now, the rest on release); others fire at once. */
export function fireSlot(rt: CombatRuntime, slot: number, me: Vec, random: () => number = Math.random): boolean {
  const p = rt.player, ab = rt.slots[slot], id = SLOT_IDS[slot];
  if (!ab) { floater(rt, me, 1.9, rt.kit ? "Empty slot · set it at the Oracle" : "Choose a subclass at the Oracle", "info"); return false; }
  if (!p.alive || rt.cooldowns[id] > 0 || rt.casting || p.dash) return false;
  if (p.energy < ab.energy) { floater(rt, me, 1.9, "Not enough energy", "info"); return false; }
  if (ab.incantation) {
    spend(rt, Math.ceil(ab.energy * CAST.start));
    rt.casting = { id: rt.seq++, rune: ab.incantation, aim: { ...p.aim }, slot, ability: ab };
    return true;
  }
  spend(rt, ab.energy);
  rt.cooldowns[id] = ab.cooldown_s;
  if (ab.key === rt.kit?.subclass.signature.key) rt.passive.procs = 0;
  p.attackCd = Math.max(p.attackCd, 0.25); p.swing = 0.22; // the attack clip plays
  runEffects(rt, ab.effects, context(rt, ab, me, 1, p.aim), random);
  return true;
}

/** Finish a drawing: a fizzle pays only the start and a short recovery; a cast pays the rest and scales by the score (row C2). */
export function resolveCast(rt: CombatRuntime, me: Vec, score: IncantationScore, random: () => number = Math.random) {
  const c = rt.casting;
  if (!c) return;
  rt.casting = null;
  const id = SLOT_IDS[c.slot], pct = Math.round(score.accuracy), v2 = rt.v2;
  const setCd = (s: number) => { if (v2) v2.cd[c.ability.key] = s; else rt.cooldowns[id] = s; };
  if (score.outcome === "fail") { setCd(CAST.recovery); floater(rt, me, 1.9, `Fizzled · ${pct}%`, "info"); return; }
  const p = rt.player;
  p.energy = Math.max(0, p.energy - (c.ability.energy - Math.ceil(c.ability.energy * CAST.start))); p.sinceSpend = 0;
  setCd(c.ability.cooldown_s);
  floater(rt, me, 1.9, `${score.outcome === "enhanced" ? "Empowered" : "Cast"} · ${c.ability.name} · ${pct}%`, "info");
  p.attackCd = Math.max(p.attackCd, 0.25);
  // A v2 shape scales 0.6 (a rough sketch) to 1.5 (a clean one) (the Priest, David 2026-10-02); today's runes 0.5–1.5.
  const potency = v2 ? shapePotency(score.accuracy) : score.power, ctx = context(rt, c.ability, me, potency, c.aim);
  if (v2) { const a = c.ability as Ability & { heavy?: boolean; vfx?: Ctx["fx"] }; ctx.impact = a.heavy ? "heavy" : "ability"; ctx.fx = a.vfx; fx(rt, a.vfx?.cast, "cast", me, c.aim, ctx.impact); }
  runEffects(rt, c.ability.effects, ctx, random);
}
/** Dodge or Escape while drawing: the start cost is gone, the slot recovers briefly (row C3). */
export function cancelCast(rt: CombatRuntime) {
  if (!rt.casting) return;
  if (rt.v2) rt.v2.cd[rt.casting.ability.key] = CAST.recovery; else rt.cooldowns[SLOT_IDS[rt.casting.slot]] = CAST.recovery;
  rt.casting = null;
}
/** A v2 drawn shape's potency from its accuracy: under 50 fizzles (0), 50 → 0.6 up to 95+ → 1.5. */
export const shapePotency = (accuracy: number) => (accuracy < 50 ? 0 : accuracy >= 95 ? 1.5 : 0.6 + (0.9 * (accuracy - 50)) / 45);

// ── Effects ─────────────────────────────────────────────────────
const scaled = (st: Status | undefined, ctl: number): Status | undefined => st && {
  hold: st.hold && st.hold * ctl, distract: st.distract && st.distract * ctl, mark: st.mark,
  slow: st.slow && [st.slow[0], st.slow[1] * ctl],
};

export function runEffects(rt: CombatRuntime, effects: Effect[], ctx: Ctx, random: () => number) {
  const p = rt.player, alive = () => rt.enemies.filter(e => e.state !== "dead" && e.state !== "return");
  for (let i = 0; i < effects.length; i++) {
    const ef = effects[i];
    const src = (power: number, from: Vec, more: Partial<HitSrc> = {}): HitSrc => ({ power: power * ctx.dmg, from, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact, ult: ctx.ult, ...more });
    switch (ef.kind) {
      case "projectile": {
        const n = ef.count ?? 1, speed = ef.speed ?? 16, base = Math.atan2(ctx.dir.x, ctx.dir.z);
        for (let k = 0; k < n; k++) {
          const a = base + (n > 1 ? (k / (n - 1) - 0.5) * (ef.spread ?? 0) : 0), vx = Math.sin(a), vz = Math.cos(a);
          const hit: ShotHit = { power: ef.power * ctx.dmg, stat: ctx.stat, tier: ctx.tier, pierce: ef.pierce, splash: ef.splash, status: scaled(ef.status, ctx.ctl), hitIds: [],
            impact: ctx.impact, ult: ctx.ult, fx: ctx.fx?.impact };
          rt.projectiles.push({ id: rt.seq++, x: ctx.pos.x + vx * 0.5, z: ctx.pos.z + vz * 0.5, vx: vx * speed, vz: vz * speed, life: (ef.range ?? 10) / speed,
            from: "player", damage: 0, kind: ctx.stat === "finesse" ? "arrow" : "bolt", radius: 0.25, hit });
        }
        break;
      }
      case "area": {
        const center = ef.at === "aim" ? ctx.aim : ctx.pos, face = Math.atan2(ctx.dir.x, ctx.dir.z);
        const end = ef.length ? { x: ctx.pos.x + ctx.dir.x * ef.length, z: ctx.pos.z + ctx.dir.z * ef.length } : null;
        let first = true;
        for (const e of alive()) {
          const inside = end ? segDist(e, ctx.pos, end) <= ef.radius + e.type.radius
            : ef.arc ? inArc(center, face, ef.radius, ef.arc, e, e.type.radius)
            : dist(center, e) <= ef.radius + e.type.radius;
          if (inside && ef.power > 0) { strike(rt, e, src(ef.power, center, { knock: ef.knock ?? 3, status: scaled(ef.status, ctx.ctl), first }), random); first = false; }
          else if (inside && ef.status) applyStatus(e, ef.status, ctx.ctl);
        }
        // Classes v2 draws its own effects from FX events (lib/game/fx/combat.ts); today's kits keep the flat blast.
        if (rt.v2) { fx(rt, ctx.fx?.impact, "impact", center, ctx.aim, ctx.impact ?? "ability", ef.radius); fx(rt, ctx.fx?.zone, "zone", center, ctx.aim, ctx.impact ?? "ability", ef.radius); }
        else rt.blasts.push({ id: rt.seq++, x: center.x, z: center.z, radius: ef.radius, color: ctx.color, age: 0, life: 0.5, arc: ef.arc, rot: face, length: ef.length });
        break;
      }
      case "dash": {
        const d = ef.back ? { x: -ctx.dir.x, z: -ctx.dir.z } : ctx.dir;
        const travel = ef.back ? ef.distance : Math.min(ef.distance, Math.max(1.5, dist(ctx.pos, ctx.aim) + (ef.power ? 1.5 : 0)));
        const end = { x: ctx.pos.x + d.x * travel, z: ctx.pos.z + d.z * travel };
        if (ef.power) for (const e of alive()) if (segDist(e, ctx.pos, end) <= 0.9 + e.type.radius) strike(rt, e, src(ef.power, ctx.pos, { knock: 3 }), random);
        const rest = effects.slice(i + 1);
        p.dash = { x: d.x, z: d.z, speed: DASH_SPEED, left: travel / DASH_SPEED, iframes: !!ef.iframes,
          then: rest.length ? (at: Vec) => runEffects(rt, rest, { ...ctx, pos: { ...at } }, random) : null };
        return; // what follows a dash happens where it lands
      }
      case "shield": addShield(rt, ef.amount * ctx.sup * p.maxHp, ef.duration); floater(rt, ctx.pos, 2.1, "Shield", "info"); break;
      case "heal": { const got = heal(rt, ef.amount * ctx.sup * p.maxHp); floater(rt, ctx.pos, 2.1, `+${Math.round(got)}`, "info"); break; }
      case "summon": summon(rt, ef.unit, ef.count ?? 1, ctx, ctx.ability.key); break;
      case "buff": addBuff(rt, { stat: ef.stat, value: ef.stat === "block" ? ef.value * ctx.gear : ef.value, t: ef.duration, onBlock: ef.stat === "block" ? ctx.ability : undefined, source: ctx.ability.key }); break;
      case "transform": {
        rt.transform = { name: ctx.ability.name, t: Math.max(ef.duration, rt.transform?.t ?? 0) };
        const pv = passiveOf(rt);
        if (pv?.kind === "transform_shield") addShield(rt, p.maxHp * pv.value, 4);
        break;
      }
      // Movement hooks (classes v2): carried speed along the aim, a hop; the avatar applies them on its next step.
      case "momentum": p.kick = addKick(p.kick, ctx.dir.x, ctx.dir.z, ef.speed, 0); break;
      case "launch": p.kick = addKick(p.kick, 0, 0, 0, ef.height); break;
    }
  }
}

// ── Units ───────────────────────────────────────────────────────
const minionCost = (u: Unit) => (u.def.kind === "minion" && u.source !== "weapon" ? u.def.cost ?? 1 : 0);
/** Caps (row 50): the oldest goes when a new one would pass them. */
function enforceCaps(rt: CombatRuntime, added: Unit) {
  const drop = (pred: (u: Unit) => boolean, max: number) => {
    let list = rt.units.filter(pred);
    while (list.length > max) { const old = list[0]; rt.units = rt.units.filter(u => u !== old); list = list.slice(1); }
  };
  const k = added.def.kind;
  if (k === "totem") { rt.units = rt.units.filter(u => u === added || u.def.key !== added.def.key); drop(u => u.def.kind === "totem", CAPS.totems); }
  else if (k === "trap") drop(u => u.def.kind === "trap", CAPS.traps);
  else if (k === "decoy") drop(u => u.def.kind === "decoy", CAPS.decoys);
  else if (added.source === "weapon") drop(u => u.source === "weapon", CAPS.weaponWisps);
  else {
    const cap = capacityOf(rt);
    while (rt.units.reduce((n, u) => n + minionCost(u), 0) > cap) {
      const old = rt.units.find(u => minionCost(u) > 0 && u !== added);
      if (!old) break;
      rt.units = rt.units.filter(u => u !== old);
    }
  }
}

export function summon(rt: CombatRuntime, key: string, count: number, ctx: Pick<Ctx, "pos" | "aim" | "dir" | "sup" | "stat">, source: string) {
  const p = rt.player;
  for (let n = 0; n < count; n++) {
    let unit = key === "weapon" ? minionFor(p.weapon) : key;
    let body: Enemy | null = null;
    if (unit === "corpse") { // Raise Shade: the freshest body nearby, else a bone wisp (plan edge case)
      const corpse = rt.enemies.filter(e => e.state === "dead" && !e.raised && e.deadFor < 20 && dist(e, ctx.pos) < 8 && e.type.kind !== "boss").sort((a, b) => a.deadFor - b.deadFor)[0];
      if (corpse) { corpse.raised = true; unit = "shade"; body = spawnEnemy(`shade-${rt.seq}`, corpse.type, corpse.x, corpse.z); }
      else unit = "bone-wisp";
    }
    const def = UNITS[unit];
    const side = (n % 2 ? -1 : 1) * (0.9 + n * 0.3);
    const at = def.kind === "totem" || def.kind === "trap" ? ctx.aim : def.kind === "decoy" ? ctx.pos
      : body ? { x: body.x, z: body.z } : { x: ctx.pos.x - ctx.dir.z * side, z: ctx.pos.z + ctx.dir.x * side };
    if (!body && def.model) body = spawnEnemy(`ally-${rt.seq}`, ENEMIES[def.model], at.x, at.z);
    if (body) body.state = "chase";
    const hp = body && unit === "shade" ? Math.min(140, Math.round(body.type.hp * 0.6)) : def.hp;
    const u: Unit = { id: rt.seq++, def, source, x: at.x, z: at.z, hp, maxHp: hp, life: def.life === undefined ? null : def.life * (rt.v2?.mods.duration ?? 1), cd: 0.3,
      power: (def.power ?? 0) * ctx.sup * (rt.v2?.mods.summonPower ?? 1), stat: ctx.stat, body };
    rt.units.push(u);
    enforceCaps(rt, u);
  }
  if (source !== "weapon") floater(rt, ctx.pos, 2.1, UNITS[key]?.name ?? (key === "corpse" ? "Raise Shade" : "Summon"), "info");
}

/** Totem circles covering a spot (Shaman Resonance: two or more overlapping work harder). */
function resonance(rt: CombatRuntime, at: Vec): number {
  const pv = passiveOf(rt);
  if (pv?.kind !== "resonance") return 1;
  return rt.units.filter(u => u.def.kind === "totem" && dist(u, at) <= u.def.radius!).length >= 2 ? 1 + pv.value : 1;
}

/** Summons chase and fight, totems pulse each second, traps spring, decoys hold aggro; the player-relative leash keeps them close. */
const foe = (e: Enemy) => e.state !== "dead" && e.state !== "return";
export function stepUnits(rt: CombatRuntime, me: Vec, dt: number, random: () => number = Math.random) {
  const p = rt.player, foes = rt.enemies, units = rt.units; // a unit that leaves makes a new list: this frame keeps the old
  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui];
    if (u.life !== null) u.life -= dt;
    if ((u.life !== null && u.life <= 0) || u.hp <= 0) { rt.units = rt.units.filter(x => x !== u); continue; }
    u.cd -= dt;
    const d = u.def;
    if (d.kind === "totem") {
      if (u.cd > 0) continue;
      u.cd = 1;
      const pl = d.pulse!;
      for (const e of foes) if (foe(e) && dist(u, e) <= d.radius! + e.type.radius) {
        if (pl.damage) strike(rt, e, { power: pl.damage * resonance(rt, e), from: u, stat: u.stat, unit: true, knock: 0 }, random);
        if (pl.slow) applyStatus(e, { slow: [pl.slow, 1.3] });
      }
      if (dist(u, me) <= d.radius!) {
        if (pl.heal) heal(rt, pl.heal * p.maxHp * resonance(rt, me));
        if (pl.shield && p.shield < p.maxHp * 0.25) addShield(rt, pl.shield * p.maxHp * resonance(rt, me), 2);
      }
      rt.blasts.push({ id: rt.seq++, x: u.x, z: u.z, radius: d.radius!, color: pl.damage ? "#ff9d5c" : pl.heal ? COLOR.heal : COLOR.shield, age: 0, life: 0.45 });
      continue;
    }
    if (d.kind === "trap") {
      const e = foes.find(f => foe(f) && dist(u, f) <= d.radius! + f.type.radius);
      if (e) {
        strike(rt, e, { power: u.power, from: u, stat: u.stat, unit: true, knock: 0, status: { hold: 3 } }, random);
        rt.blasts.push({ id: rt.seq++, x: u.x, z: u.z, radius: 1.4, color: "#ffe08a", age: 0, life: 0.5 });
        rt.units = rt.units.filter(x => x !== u);
      }
      continue;
    }
    if (d.kind === "decoy") continue;
    // Minions: the nearest foe within reach of both it and you, else back to your side.
    let target: Enemy | undefined, near = 9;
    for (const e of foes) { const de = foe(e) && dist(e, me) < 12 ? dist(e, u) : Infinity; if (de < near) { near = de; target = e; } }
    const range = d.range ?? 1.5, gap = target ? dist(target, u) : dist(me, u);
    const goal = dist(me, u) > 12 || !target ? me : target;
    const stop = target && goal === target ? range * 0.8 : 1.4;
    if (gap > stop || goal === me) {
      const g = dist(goal, u);
      if (g > stop) { const step = Math.min(g - stop, (d.speed ?? 5) * dt); u.x += ((goal.x - u.x) / g) * step; u.z += ((goal.z - u.z) / g) * step; }
    }
    if (u.body) { u.body.x = u.x; u.body.z = u.z; u.body.facing = facingTo(u, target ?? me); u.body.t += dt; if (u.body.state === "recover" && u.body.t > 0.5) { u.body.state = "chase"; u.body.t = 0; } }
    if (!target || dist(target, u) > range + target.type.radius || u.cd > 0) continue;
    u.cd = d.rate ?? 1;
    if (d.ranged) {
      const g = dist(target, u) || 1;
      rt.projectiles.push({ id: rt.seq++, x: u.x, z: u.z, vx: ((target.x - u.x) / g) * 14, vz: ((target.z - u.z) / g) * 14, life: (range + 1) / 14, from: "player", damage: 0, kind: "bolt", radius: 0.2,
        hit: { power: u.power, stat: u.stat, unit: true } });
    } else {
      strike(rt, target, { power: u.power, from: u, stat: u.stat, unit: true, knock: 1.5 }, random);
      if (u.body) { u.body.state = "recover"; u.body.t = 0; }
    }
  }
}

/** Enemy attacks landing on units (strikes on the ring or arc they aimed, spit shots): they have health too. */
export function hurtUnits(rt: CombatRuntime, lands: (u: Unit) => boolean, amount: number) {
  for (const u of rt.units) if (u.def.kind !== "trap" && lands(u)) { u.hp -= amount; floater(rt, u, 1.4, `-${amount}`, "hurt"); }
}
/** Where an enemy goes: a phantom or a bulwark crab near it draws it; a distracted one wanders home. (One scratch target: read it before the next call.) */
const TARGET = { x: 0, z: 0, safe: false, alive: true };
export function enemyTarget(rt: CombatRuntime, e: Enemy, player: Vec & { safe: boolean; alive: boolean }): Vec & { safe: boolean; alive: boolean } {
  let t: Vec | null = e.status.distract > 0 ? { x: e.spawnX, z: e.spawnZ } : null, best = e.type.aggroRadius + 3;
  if (!t) for (const u of rt.units) { const d = u.def.taunt ? dist(u, e) : Infinity; if (d < best) { best = d; t = u; } }
  if (!t) return player;
  TARGET.x = t.x; TARGET.z = t.z; TARGET.safe = player.safe; TARGET.alive = player.alive;
  return TARGET;
}
