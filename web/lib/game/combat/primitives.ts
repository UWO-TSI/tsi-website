/**
 * Classes v2 shared primitives (design sheet §1.1: a mechanic a kit needs becomes one more shared primitive with tests,
 * never a per-subclass controller): lasting zones, pulls, teleports that keep your speed, counter windows (a parry, a
 * Perfect Shift), stealth, minion orders, corpse detonations, consuming a minion, slide surfing, stone walls, a sweeping
 * trap, delayed stages, forms, raising the dead, bursts, and clones that fight beside you. Pure over the runtime like
 * abilities.ts (which dispatches the effects here); `stepField` runs once a tick at the end of the encounter tick.
 */
import { traitTier, type Effect } from "@/lib/combat/kits";
import { WEAPON_SKINS, type FormDef } from "@/lib/combat/classes";
import type { EnemyType } from "./contract";
import { addShield, applyStatus, chargeUlt, floater, fx, heal, runEffects, strike, summon, type Ctx } from "./abilities";
import { addKick } from "./moveHooks";
import { segDist, type Enemy, type Vec } from "./sim";
import { combat, type CombatRuntime, type Projectile, type Unit } from "./runtime";

export interface Zone { id: number; source: string; x: number; z: number; dx: number; dz: number; r: number; length: number; life: number; every: number; tick: number;
  power: number; heal: number; slow: number; pull: number; blind: number; follow: boolean; seek: number; fx?: string; ctx: Ctx;
  /** Its ticks don't hold an enemy's chase (burning ground under a hail of arrows). */
  steady?: boolean }
/** A stone wedge: centre, the way it faces (its high side away from the caster), width across, depth along, height at the far side. */
export interface Wall { id: number; x: number; z: number; dx: number; dz: number; w: number; d: number; h: number; life: number; t: number }
/** A sweeping trap: where its line is now, where it set out, the way it goes, its width, what it carries. */
export interface Sweep { id: number; x: number; z: number; x0: number; z0: number; dx: number; dz: number; w: number; speed: number; left: number; gone: number; hold: number; trapped: Enemy[]; effects: Effect[]; ctx: Ctx; t: number }
export interface Timer { left: number; effects: Effect[]; ctx: Ctx }
/** What a counter window answers with: the share of a hit it cuts, enemy shots only or any hit, a reflected shot's power. */
export interface Counter { left: number; negate: number; vs: "shot" | "any"; reflect: number; effects: Effect[]; ctx: Ctx }
export interface Field {
  zones: Zone[]; walls: Wall[]; sweeps: Sweep[]; timers: Timer[];
  /** Minions: free (the nearest foe), charging one enemy, or back guarding you. */
  order: { mode: "free" | "charge" | "guard"; target: string | null };
  /** A thrown mark to teleport to (Trick Card), per ability. */
  marks: Record<string, Vec>;
  /** The open counter window, the stealth left (and what reveals you: an enemy this near, moving faster than `walk`), the bonus the first hit out of it gets, a slide surf. */
  counter: Counter | null; stealth: number; reveal: number; walk: number; ambush: number; ambushFor: number;
  surf: { left: number; speed: number; power: number; hit: string[]; ctx: Ctx } | null;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const alive = (e: Enemy) => e.state !== "dead" && e.state !== "return";
/** Corpses last this long (s) unless a Grave Tithe kill doubled theirs. */
export const CORPSE_LIFE = 20;
const longer = new WeakMap<Enemy, number>();
export const corpseLife = (e: Enemy) => longer.get(e) ?? CORPSE_LIFE;
export const keepCorpse = (e: Enemy, seconds: number) => { longer.set(e, seconds); };
/** A fallen enemy that can still be raised or blown up. */
export const corpse = (e: Enemy) => e.state === "dead" && !e.raised && !e.summoned && e.deadFor < corpseLife(e) && e.type.kind !== "boss";
/** The nearest of `list` to `at` inside `within` that passes `ok` (no list built: the tick calls it every frame). */
const nearestTo = <T extends Vec>(list: readonly T[], at: Vec, within = Infinity, ok: (x: T) => boolean = () => true) => {
  let best: T | null = null, bd = within;
  for (const x of list) { if (!ok(x)) continue; const d = dist(x, at); if (d < bd) { bd = d; best = x; } }
  return best;
};
const isClone = (u: Unit) => u.def.kind === "clone";
/** Minions that are yours (a weapon's wisps and an ult's free army aside, they cost capacity). */
const yours = (rt: CombatRuntime) => rt.units.filter(u => u.def.kind === "minion" && u.source !== "weapon");

/** Bodies for allies that no enemy lends (kits.ts UNITS `model`): the Necromancer's skeletons. */
export const ALLY_BODIES: Record<string, EnemyType> = {
  "skeleton-warrior": { id: "skeleton-warrior", name: "Skeleton", kind: "construct", level: 1, hp: 30, speed: 5.6, radius: 0.32, defense: 0, armor: 0, xp: 0, elite: false,
    aggroRadius: 0, leashRadius: 0, attacks: [{ shape: "lunge", windup: 0.2, recover: 0.3, damage: 0, range: 1.4, arc: 1, knockback: 0 }],
    model: "/assets/game/enemies/skeleton-warrior.glb", modelScale: 1.3, modelYaw: 0, hover: 0 },
};

/** Why an ability can't start now (its target is missing), or null. Nothing is spent on a refusal. */
export function refusal(rt: CombatRuntime, effects: Effect[], aim: Vec, key: string): string | null {
  for (const e of effects) {
    if (e.kind === "consume" && !yours(rt).length) return "No minion to consume";
    if (e.kind === "detonate" && !nearestTo([...yours(rt), ...rt.enemies.filter(corpse)], aim, e.range)) return "Nothing to detonate there";
    if (e.kind === "teleport" && e.to === "unit" && !rt.units.some(u => u.def.key === e.unit)) return "No clone to swap with";
    if (e.kind === "teleport" && e.to === "mark" && !rt.field.marks[key]) return "Throw it first";
    if (e.kind === "pull" && !pullTarget(rt, rt.player.last ?? aim, aim, e.range)) return "Nothing to pull";
  }
  return null;
}
/** The enemy under (or nearest) the aim, within `range` of you. */
const pullTarget = (rt: CombatRuntime, me: Vec, aim: Vec, range: number) =>
  nearestTo(rt.enemies.filter(e => alive(e) && dist(e, me) <= range), aim, 6) ?? null;

// ── The effects ─────────────────────────────────────────────────
export function runPrimitive(rt: CombatRuntime, ef: Effect, ctx: Ctx, random: () => number) {
  const p = rt.player, f = rt.field;
  switch (ef.kind) {
    case "zone": {
      const at = ef.at === "aim" ? ctx.aim : ctx.pos;
      f.zones.push({ id: rt.seq++, source: ctx.ability.key, x: at.x, z: at.z, dx: ctx.dir.x, dz: ctx.dir.z, r: ef.radius, length: ef.length ?? 0, life: ef.duration, every: ef.every ?? 0.5, tick: 0,
        power: (ef.power ?? 0) * ctx.dmg, heal: (ef.heal ?? 0) * ctx.sup, slow: ef.slow ?? 0, pull: ef.pull ?? 0, blind: ef.blind ?? 0, follow: !!ef.follow, seek: ef.seek ?? 0, fx: ef.fx, ctx });
      return;
    }
    case "pull": {
      const e = pullTarget(rt, ctx.pos, ctx.aim, ef.range);
      if (!e) return;
      const d = dist(e, ctx.pos), go = Math.max(0, d - 1.4), k = (e.type.kind === "boss" || e.type.miniboss ? 0.1 : e.type.elite ? 0.5 : 1) * go * 8; // knock decays at 8/s: k/8 u
      if (ef.power) strike(rt, e, { power: ef.power * ctx.dmg, from: ctx.pos, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact, ult: ctx.ult, knock: 0, status: ef.status }, random);
      else if (ef.status) applyStatus(e, ef.status, ctx.ctl);
      e.kx = ((ctx.pos.x - e.x) / (d || 1)) * k; e.kz = ((ctx.pos.z - e.z) / (d || 1)) * k; e.stun = Math.max(e.stun, 0.4);
      fx(rt, ctx.fx?.impact, "impact", e, ctx.pos, ctx.impact ?? "ability", undefined, ctx.ramp);
      return;
    }
    case "teleport": {
      let to: Vec | null = null;
      if (ef.to === "unit") {
        const u = nearestTo(rt.units.filter(x => x.def.key === ef.unit), ctx.aim);
        if (u) { to = { x: u.x, z: u.z }; u.x = ctx.pos.x; u.z = ctx.pos.z; } // it takes your place
      } else { to = f.marks[ctx.ability.key] ?? null; delete f.marks[ctx.ability.key]; }
      if (!to) return;
      p.kick = addKick(p.kick, 0, 0, 0, 0);
      p.kick.to = { x: to.x, z: to.z };
      if (ef.heal) heal(rt, ef.heal * ctx.sup * p.maxHp);
      fx(rt, ctx.fx?.impact, "impact", to, ctx.pos, "ability", undefined, ctx.ramp);
      return;
    }
    case "counter":
      f.counter = { left: ef.window, negate: ef.negate, vs: ef.vs ?? "any", reflect: (ef.reflect ?? 0) * ctx.dmg, effects: ef.effects ?? [], ctx };
      return;
    case "stealth":
      f.stealth = ef.duration; f.reveal = ef.reveal; f.walk = ef.walk ?? 0; f.ambush = ef.bonus; f.ambushFor = 0;
      if (ef.duration >= 1) floater(rt, ctx.pos, 2.1, "Vanished", "info");
      return;
    case "command": {
      const target = f.order.mode === "charge" ? null : nearestTo(rt.enemies.filter(e => alive(e) && dist(e, ctx.pos) < 16), ctx.aim);
      f.order = target ? { mode: "charge", target: target.id } : { mode: "guard", target: null };
      floater(rt, ctx.pos, 2.1, target ? "Charge!" : "To me!", "info");
      if (target) fx(rt, ctx.fx?.impact, "impact", target, ctx.pos, "ability", undefined, ctx.ramp);
      return;
    }
    case "detonate": {
      const first = nearestTo([...yours(rt), ...rt.enemies.filter(corpse)], ctx.aim, ef.range);
      if (!first) return;
      const queue: Vec[] = [first], done = new Set<Vec>([first]);
      for (let n = 0; n < queue.length && n <= ef.links; n++) {
        const at = queue[n];
        if ("def" in at) rt.units = rt.units.filter(u => u !== at); else (at as Enemy).raised = true; // a minion is spent; a corpse can't rise again
        for (const e of rt.enemies) if (alive(e) && dist(e, at) <= ef.radius + e.type.radius) strike(rt, e, { power: ef.power * ctx.dmg, from: at, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact, ult: ctx.ult, knock: 4, first: n === 0 }, random);
        fx(rt, ctx.fx?.impact, "impact", at, ctx.pos, ctx.impact ?? "ability", ef.radius, ctx.ramp);
        for (const c of rt.enemies) if (corpse(c) && !done.has(c) && dist(c, at) <= ef.chain) { done.add(c); queue.push(c); }
      }
      return;
    }
    case "consume": {
      const u = yours(rt)[0];
      if (!u) return;
      rt.units = rt.units.filter(x => x !== u);
      const got = heal(rt, ef.heal * ctx.sup * p.maxHp);
      addShield(rt, ef.shield * ctx.sup * p.maxHp, ef.duration);
      floater(rt, ctx.pos, 2.1, `+${Math.round(got)} · Bone shield`, "info");
      fx(rt, ctx.fx?.impact, "impact", u, ctx.pos, "ability", undefined, ctx.ramp);
      return;
    }
    case "surf": {
      const speed = Math.max(12, p.move.speed);
      f.surf = { left: ef.duration, speed, power: ef.power * ctx.dmg, hit: [], ctx };
      return;
    }
    case "wall": {
      const d = Math.min(6, Math.max(2, dist(ctx.pos, ctx.aim)));
      f.walls.push({ id: rt.seq++, x: ctx.pos.x + ctx.dir.x * d, z: ctx.pos.z + ctx.dir.z * d, dx: ctx.dir.x, dz: ctx.dir.z, w: ef.width, d: ef.depth, h: ef.height, life: ef.duration, t: 0 });
      if (f.walls.length > 2) f.walls.shift(); // two stand at most
      return;
    }
    case "sweep":
      f.sweeps.push({ id: rt.seq++, x: ctx.pos.x, z: ctx.pos.z, x0: ctx.pos.x, z0: ctx.pos.z, dx: ctx.dir.x, dz: ctx.dir.z, w: ef.width, speed: ef.speed, left: ef.distance, gone: 0, hold: ef.hold, trapped: [], effects: ef.effects, ctx, t: 0 });
      return;
    case "delay":
      f.timers.push({ left: ef.seconds, effects: ef.effects, ctx: { ...ctx, pos: { ...ctx.pos }, aim: { ...ctx.aim } } });
      return;
    case "form":
      setForm(rt, ef.form);
      return;
    case "raise": {
      const bodies = rt.enemies.filter(e => corpse(e) && dist(e, ctx.aim) <= ef.radius).sort((a, b) => a.deadFor - b.deadFor).slice(0, ef.max);
      for (const b of bodies) {
        b.raised = true;
        summon(rt, ef.unit, 1, { ...ctx, pos: { x: b.x, z: b.z }, aim: { x: b.x, z: b.z } }, ctx.ability.key, undefined, { x: b.x, z: b.z });
      }
      if (!bodies.length && ef.fallback) summon(rt, ef.fallback, 1, ctx, ctx.ability.key);
      return;
    }
    case "burst":
      for (const u of rt.units.filter(x => x.source === ctx.ability.key && x.def.burst)) burstUnit(rt, u, ctx, random);
      return;
  }
}

function burstUnit(rt: CombatRuntime, u: Unit, ctx: Pick<Ctx, "stat" | "tier" | "impact" | "ult" | "fx" | "pos" | "ramp">, random: () => number) {
  const b = u.def.burst!;
  rt.units = rt.units.filter(x => x !== u);
  for (const e of rt.enemies) if (alive(e) && dist(e, u) <= b.radius + e.type.radius) strike(rt, e, { power: b.power * (u.power / Math.max(1e-6, u.def.power ?? 1)), from: u, stat: u.stat, unit: true, knock: 3, impact: ctx.impact, ult: ctx.ult }, random);
  fx(rt, ctx.fx?.zone, "zone", u, u, "ability", b.radius, ctx.ramp);
}

// ── Forms (the Transmuter) ──────────────────────────────────────
/** Take a form: its standing buffs replace the last form's (a source "form" buff that lasts until the next shift). "human" (or none) is your own body. */
export function setForm(rt: CombatRuntime, form: string) {
  const v = rt.v2;
  if (!v) return;
  const def = form === "human" ? null : v.kit.forms?.[form] ?? null;
  if (form === "previous") return setForm(rt, v.formBefore ?? "human");
  if (def && form === "chimera" && v.form !== "chimera") v.formBefore = v.form;
  v.form = def ? form : null;
  rt.buffs = rt.buffs.filter(b => b.source !== "form");
  if (!def) return;
  for (const [stat, value] of [["block", def.block], ["guard", def.guard], ["speed", def.speed], ["damage", def.damage]] as const)
    if (value) rt.buffs.push({ stat, value, t: 1e9, source: "form" });
}
/** The click attack a form brings, or null in your own body. */
export const formBasic = (rt: CombatRuntime) => (rt.v2?.form ? rt.v2.kit.forms?.[rt.v2.form]?.basic ?? null : null);
/** A form's weapon tier: its trait's defeats (traitTier: tier 2 at the first, 3 at 10, 4 at 30), not the charm's; the Chimera the best of them. */
export function formTier(rt: CombatRuntime, form: string | null | undefined): number | undefined {
  const v = rt.v2, forms = v?.kit.forms;
  if (!v || !forms || !form) return undefined;
  const of = (f: FormDef | undefined) => (f?.trait ? traitTier(v.traits[f.trait] ?? 0) : undefined);
  return form === "chimera" ? Math.max(0, ...Object.values(forms).map(of).filter((t): t is number => t !== undefined)) || undefined : of(forms[form]);
}

// ── Hooks the tick and the hit paths call ───────────────────────
/** How long an enemy keeps its call on which of you is real before it makes a fresh one. */
export const CALL_EVERY = 2.5;
/** Each enemy's call, re-made every CALL_EVERY s (seeded by its id and the moment): over a fight it spends `share` of its time on a clone. */
function fooled(e: Enemy, share: number, clock: number): boolean {
  const key = `${e.id}:${Math.floor(clock / CALL_EVERY)}`;
  let h = 2166136261; // FNV-1a and a murmur finish: keys that differ by one character still spread evenly
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return ((h >>> 0) % 1000) / 1000 < share;
}
/**
 * Where an enemy goes instead of you (abilities.ts enemyTarget): home while you're unseen, or the clone it took for
 * you: a decoy share of the time (Who's Real?: a fresh call every few seconds) it goes after a clone.
 */
export function lure(rt: CombatRuntime, e: Enemy): Vec | null {
  const f = rt.field;
  if (f.stealth > 0) return { x: e.spawnX, z: e.spawnZ };
  const share = rt.v2?.passive.kind === "decoy_share" ? rt.v2.passive.value : 0;
  if (!share) return null;
  return rt.units.some(isClone) && fooled(e, share, rt.v2!.clock) ? nearestTo(rt.units, e, Infinity, isClone) : null;
}

/** Stealth ends when you attack or cast; the bonus waits for your first hit for a moment. */
export function reveal(rt: CombatRuntime) {
  const f = rt.field;
  if (f.stealth > 0) { f.stealth = 0; f.ambushFor = 1.5; }
}
/** The first hit out of stealth: its bonus (spent). */
export function takeAmbush(rt: CombatRuntime): number {
  const f = rt.field;
  if (f.ambush <= 0 || f.stealth > 0) return 0;
  const b = f.ambush;
  f.ambush = 0;
  return b;
}

/**
 * A hit on you (hurtPlayer, before guard and shield): the open counter window cuts it and answers, a blinding zone
 * round the attacker makes it miss. Returns what's left of the hit and whether it flinches you.
 */
export function counterHit(rt: CombatRuntime, amount: number, from: Vec, me: Vec, random: () => number, shot = false): { amount: number; flinch: boolean } {
  const f = rt.field, c = f.counter;
  for (const z of f.zones) if (z.blind > 0 && inZone(z, from, 0) && random() < z.blind) { floater(rt, me, 1.7, "Missed", "info"); return { amount: 0, flinch: false }; }
  if (!c || c.left <= 0 || (c.vs === "shot" && !shot)) return { amount, flinch: true };
  f.counter = null;
  floater(rt, me, 1.9, c.negate >= 1 ? "Perfect" : "Countered", "info");
  if (c.effects.length) runEffects(rt, c.effects, { ...c.ctx, pos: { ...me }, aim: { ...from }, dir: unit(from, me) }, random);
  return { amount: amount * (1 - c.negate), flinch: false };
}
const unit = (to: Vec, from: Vec) => { const d = dist(to, from) || 1; return { x: (to.x - from.x) / d, z: (to.z - from.z) / d }; };

/**
 * An enemy shot reaching you (encounter.ts): a shot counter sends it back at its shooter; looking at one of your
 * clones it bounces through the clone instead, doubled, faster and a sure crit. Returns true when it was answered.
 */
export function parryShot(rt: CombatRuntime, sh: Projectile, me: Vec): boolean {
  const c = rt.field.counter;
  if (!c || c.left <= 0 || !c.reflect) return false;
  rt.field.counter = null;
  const back = { x: sh.x - sh.vx, z: sh.z - sh.vz }, shooter = nearestTo(rt.enemies.filter(e => alive(e) && segDist(e, sh, back) < 2.5 + e.type.radius), sh) ?? nearestTo(rt.enemies.filter(alive), me);
  const clone = nearestTo(rt.units.filter(u => u.def.kind === "clone"), rt.player.aim, 2.5);
  const from = clone ?? me, to = shooter ?? back, d = dist(to, from) || 1, speed = clone ? 30 : 20;
  rt.projectiles.push({ id: rt.seq++, x: from.x, z: from.z, vx: ((to.x - from.x) / d) * speed, vz: ((to.z - from.z) / d) * speed, life: (d + 2) / speed, from: "player", damage: 0, kind: "card", radius: clone ? 0.5 : 0.3,
    hit: { power: c.reflect * (clone ? 2 : 1), stat: c.ctx.stat, crit: !!clone, impact: clone ? "heavy" : "ability", fx: c.ctx.fx?.impact, ramp: rt.v2?.kit.look.ramp, hitIds: [] } });
  floater(rt, me, 1.9, clone ? "Mirrored!" : "Reflected", "info");
  fx(rt, c.ctx.fx?.cast, "impact", from, to, clone ? "heavy" : "ability");
  return true;
}

/** A clone's own ward (mastery 20: clones use skill 3): its first enemy shot each few seconds goes back. */
export function cloneWard(rt: CombatRuntime, u: Unit): boolean {
  if (u.def.kind !== "clone" || !u.ai || u.ai.ward > 0 || (rt.v2?.mastery ?? 0) < 20) return false;
  u.ai.ward = 4;
  floater(rt, u, 1.6, "Reflected", "info");
  return true;
}

const inZone = (z: Zone, at: Vec, r: number) =>
  z.length > 0 ? segDist(at, z, { x: z.x + z.dx * z.length, z: z.z + z.dz * z.length }) <= z.r + r : dist(at, z) <= z.r + r;

// ── Walls (the movement world and the shots read them) ──────────
/** The wall's height at a point above the ground there (0 outside it): a ramp from the near side up to `h` at the far side. */
export function wallHeight(rt: CombatRuntime, x: number, z: number): number {
  let top = 0;
  for (const w of rt.field.walls) {
    const ox = x - w.x, oz = z - w.z, u = ox * w.dx + oz * w.dz, v = -ox * w.dz + oz * w.dx;
    if (Math.abs(v) > w.w / 2 || Math.abs(u) > w.d / 2) continue;
    const rise = Math.min(1, w.t / 0.25); // it bursts up out of the ground
    top = Math.max(top, w.h * rise * (0.15 + 0.85 * (u + w.d / 2) / w.d));
  }
  return top;
}
/** Solid for bodies and shots: where it stands taller than a step. */
export const inWall = (rt: CombatRuntime, x: number, z: number, r = 0) =>
  rt.field.walls.length > 0 && (wallHeight(rt, x, z) > 0.45 || (r > 0 && (wallHeight(rt, x + r, z) > 0.45 || wallHeight(rt, x - r, z) > 0.45 || wallHeight(rt, x, z + r) > 0.45 || wallHeight(rt, x, z - r) > 0.45)));

// ── One tick of the field ───────────────────────────────────────
export function stepField(rt: CombatRuntime, me: Vec, dt: number, random: () => number) {
  const f = rt.field, p = rt.player;
  // Zones: follow or wander, then their pulse (damage, heal, slow) and their pull every frame.
  for (let i = f.zones.length - 1; i >= 0; i--) {
    const z = f.zones[i];
    if ((z.life -= dt) <= 0) { f.zones.splice(i, 1); continue; }
    if (z.follow) { z.x = me.x; z.z = me.z; }
    if (z.seek) {
      const e = nearestTo(rt.enemies, z, 9, alive);
      if (e) { const d = dist(e, z) || 1, st = Math.min(d, z.seek * dt); z.x += ((e.x - z.x) / d) * st; z.z += ((e.z - z.z) / d) * st; }
    }
    if (z.pull) for (const e of rt.enemies) if (alive(e) && inZone(z, e, e.type.radius)) {
      const d = dist(e, z) || 1, st = Math.min(d - 0.2, z.pull * dt * (e.type.kind === "boss" ? 0.15 : 1));
      if (st > 0) { e.x += ((z.x - e.x) / d) * st; e.z += ((z.z - e.z) / d) * st; }
    }
    if ((z.tick -= dt) > 0) continue;
    z.tick += z.every;
    let first = true;
    for (const e of rt.enemies) if (alive(e) && inZone(z, e, e.type.radius)) {
      if (z.power) { strike(rt, e, { power: z.power * z.every, from: z, stat: z.ctx.stat, tier: z.ctx.tier, impact: "light", ult: z.ctx.ult, knock: 0, first, steady: z.steady }, random); first = false; }
      if (z.slow) applyStatus(e, { slow: [z.slow, z.every + 0.6] });
    }
    if (z.heal && inZone(z, me, 0)) heal(rt, z.heal * z.every * p.maxHp);
    fx(rt, z.fx, "zone", z, { x: z.x + z.dx * z.length, z: z.z + z.dz * z.length }, "ability", z.r, z.ctx.ramp);
  }
  for (let i = f.walls.length - 1; i >= 0; i--) { const w = f.walls[i]; w.t += dt; if ((w.life -= dt) <= 0) f.walls.splice(i, 1); }
  // Sweeps carry what they cross; at the end their effects land on the line's centre and let go.
  for (let i = f.sweeps.length - 1; i >= 0; i--) {
    const s = f.sweeps[i], step = Math.min(s.left, s.speed * dt), px = -s.dz, pz = s.dx;
    s.x += s.dx * step; s.z += s.dz * step; s.left -= step; s.gone += step; s.t += dt;
    // What the glass passed over this frame: across its width, between where its line was and where it is.
    for (const e of rt.enemies) {
      if (!alive(e) || s.trapped.includes(e)) continue;
      const r = e.type.radius, along = (e.x - s.x0) * s.dx + (e.z - s.z0) * s.dz;
      if (Math.abs((e.x - s.x) * px + (e.z - s.z) * pz) <= s.w / 2 + r && along <= s.gone + r && along >= s.gone - step - r - 0.3) s.trapped.push(e);
    }
    for (const e of s.trapped) {
      const lat = (e.x - s.x) * px + (e.z - s.z) * pz;
      e.x = s.x + px * lat; e.z = s.z + pz * lat; e.facing = Math.atan2(s.dx, s.dz); e.status.hold = Math.max(e.status.hold, 0.3); e.flat = 1;
    }
    if (s.left > 0) continue;
    f.sweeps.splice(i, 1);
    for (const e of s.trapped) { e.flat = 0; e.status.hold = Math.max(e.status.hold, s.hold * (e.type.kind === "boss" ? 0.3 : 1)); }
    runEffects(rt, s.effects, { ...s.ctx, pos: { x: s.x, z: s.z }, aim: { x: s.x + s.dx, z: s.z + s.dz } }, random);
  }
  for (let i = f.timers.length - 1; i >= 0; i--) {
    const t = f.timers[i];
    if ((t.left -= dt) > 0) continue;
    f.timers.splice(i, 1);
    runEffects(rt, t.effects, t.ctx, random);
  }
  // Marks follow the shots that carry them (Trick Card): where it is, or where it ended.
  for (const sh of rt.projectiles) if (sh.hit?.mark) f.marks[sh.hit.mark] = { x: sh.x, z: sh.z };
  // You: the counter window, stealth (an enemy close enough sees you), the bonus's grace, a surf holding the slide.
  if (f.counter && (f.counter.left -= dt) <= 0) f.counter = null;
  if (f.stealth > 0) {
    f.stealth -= dt;
    if (f.stealth <= 0 || (f.walk > 0 && p.move.speed > f.walk) || (f.reveal > 0 && rt.enemies.some(e => alive(e) && dist(e, me) < f.reveal + e.type.radius))) reveal(rt);
  } else if (f.ambushFor > 0 && (f.ambushFor -= dt) <= 0) f.ambush = 0;
  if (f.surf) {
    const s = f.surf;
    if ((s.left -= dt) <= 0 || p.move.mode !== "slide") f.surf = null;
    else {
      p.kick = addKick(p.kick, 0, 0, 0, 0);
      p.kick.hold = s.speed;
      for (const e of rt.enemies) if (alive(e) && !s.hit.includes(e.id) && dist(e, me) < 1.3 + e.type.radius) {
        s.hit.push(e.id);
        const side = Math.sign((e.x - me.x) * p.move.vz - (e.z - me.z) * p.move.vx) || 1, sp = Math.hypot(p.move.vx, p.move.vz) || 1;
        strike(rt, e, { power: s.power, from: { x: e.x - (p.move.vz / sp) * side, z: e.z + (p.move.vx / sp) * side }, stat: s.ctx.stat, impact: "ability", knock: 6 }, random);
      }
      if (Math.floor((s.left + dt) * 8) !== Math.floor(s.left * 8)) fx(rt, s.ctx.fx?.zone, "zone", me, { x: me.x + p.move.vx, z: me.z + p.move.vz }, "ability", 1, s.ctx.ramp);
    }
  }
  if (rt.field.order.mode === "charge" && !rt.enemies.some(e => e.id === f.order.target && alive(e))) f.order = { mode: "free", target: null };
  for (const u of rt.units) if (u.def.kind === "clone") stepClone(rt, u, me, dt, random);
}

/** The enemy your minions go for now (a charge order), and how far from you they guard (a recall). One scratch result: read it before the next call. */
const ORDER = { target: null as Enemy | null, reach: 12, speed: 1 };
export function orderOf(rt: CombatRuntime): typeof ORDER {
  const o = rt.field.order, e = o.mode === "charge" ? rt.enemies.find(x => x.id === o.target && alive(x)) ?? null : null;
  ORDER.target = e; ORDER.reach = e ? 20 : o.mode === "guard" ? 5 : 12; ORDER.speed = e ? 1.4 : 1;
  return ORDER;
}

/** A unit's life ran out: a bursting one goes off (an army marching to the end). */
export function expire(rt: CombatRuntime, u: Unit, random: () => number) {
  if (u.def.burst && u.life !== null && u.life <= 0) burstUnit(rt, u, { stat: u.stat, impact: "ability", pos: u }, random);
}

// ── Clones (the Illusionist): they move, throw your cards and draw enemies; mastery teaches them your skills ──
/**
 * A clone circles the foe nearest you at card range, dashes now and then, throws a card (`power` × your hit) every
 * `rate` s and stays within 9 u of you. Mastery 10: it calls a fresh double when one is missing (skill 1); mastery 20:
 * it trades places with another clone (skill 2) and sends back the first shot that reaches it (skill 3).
 */
function stepClone(rt: CombatRuntime, u: Unit, me: Vec, dt: number, random: () => number) {
  const ai = (u.ai ??= { vx: 0, vz: 0, side: random() < 0.5 ? 1 : -1, dash: 1 + random() * 2, skill: 3 + random() * 3, ward: 0, facing: 0, clip: null, mimic: 0 });
  const range = u.def.range ?? 8, speed = u.def.speed ?? 7.4, m = rt.v2?.mastery ?? 1;
  const target = nearestTo(rt.enemies, u, Infinity, e => alive(e) && dist(e, me) < 14);
  let gx = 0, gz = 0;
  if (target) {
    const d = dist(target, u) || 1, ux = (target.x - u.x) / d, uz = (target.z - u.z) / d, want = range * 0.6;
    gx = -uz * ai.side + ux * Math.max(-1, Math.min(1, (d - want) / 2)); gz = ux * ai.side + uz * Math.max(-1, Math.min(1, (d - want) / 2));
    ai.facing = Math.atan2(ux, uz);
  }
  const back = dist(me, u);
  if (back > 9 || !target) { const d = back || 1; gx = (me.x - u.x) / d * (back > 2.5 ? 1 : 0); gz = (me.z - u.z) / d * (back > 2.5 ? 1 : 0); if (!target && back > 2.5) ai.facing = Math.atan2(gx, gz); }
  if (random() < dt * 0.4) ai.side = -ai.side;
  ai.dash -= dt;
  const burst = ai.dash < 0 ? (ai.dash < -0.18 ? (ai.dash = 1.6 + random() * 1.8, 1) : 2.2) : 1;
  const l = Math.hypot(gx, gz) || 1, k = 1 - Math.exp(-10 * dt);
  ai.vx += ((gx / l) * speed * burst * Math.min(1, Math.hypot(gx, gz)) - ai.vx) * k; ai.vz += ((gz / l) * speed * burst * Math.min(1, Math.hypot(gx, gz)) - ai.vz) * k;
  u.x += ai.vx * dt; u.z += ai.vz * dt;
  ai.ward = Math.max(0, ai.ward - dt); ai.mimic = Math.max(0, ai.mimic - dt);
  // Its card, at your basic attack's power share.
  u.cd -= dt;
  if (target && u.cd <= 0 && dist(target, u) <= range + target.type.radius) {
    u.cd = (u.def.rate ?? 0.8) * (0.85 + random() * 0.3);
    const d = dist(target, u) || 1, sp = 16;
    rt.projectiles.push({ id: rt.seq++, x: u.x, z: u.z, vx: ((target.x - u.x) / d) * sp, vz: ((target.z - u.z) / d) * sp, life: (range + 1) / sp, from: "player", damage: 0, kind: "card", radius: 0.25,
      hit: { power: u.power, stat: u.stat, unit: true, ramp: rt.v2?.kit.look.ramp } });
    ai.clip = "Unique_CardFlick"; ai.mimic = 0.3;
  }
  // Mastery: its skills.
  if (m < 10 || (ai.skill -= dt) > 0) return;
  ai.skill = 5 + random() * 3;
  const cap = rt.v2?.keys.find(a => a?.effects.some(e => e.kind === "summon" && e.unit === u.def.key))?.effects.find(e => e.kind === "summon")?.cap ?? 2;
  const clones = rt.units.filter(x => x.def.kind === "clone");
  if (clones.length < cap) { // skill 1: a fresh double steps out of it
    const c: Unit = { ...u, id: rt.seq++, ai: undefined, hp: u.maxHp, life: u.def.life !== undefined ? u.def.life * (rt.v2?.mods.duration ?? 1) : null, x: u.x + ai.side * 0.8, z: u.z };
    rt.units.push(c);
    fx(rt, rt.v2?.keys[0]?.vfx?.cast, "cast", c, me, "ability");
  } else if (m >= 20 && clones.length > 1) { // skill 2: two clones trade places
    const o = clones.find(x => x !== u)!;
    [u.x, u.z, o.x, o.z] = [o.x, o.z, u.x, u.z];
    fx(rt, rt.v2?.keys[1]?.vfx?.impact, "impact", u, o, "ability");
  }
}

/** A slide-jump out of a bone surf carries more: +3 u/s along the slide (it ends the surf). True when it did. */
export function surfJump(rt: CombatRuntime): boolean {
  if (!rt.field.surf) return false;
  rt.field.surf = null;
  const p = rt.player;
  p.kick = addKick(p.kick, p.move.vx, p.move.vz, 3, 0);
  return true;
}

/** Your casts show on your clones too (they copy your animations). */
export function mimic(rt: CombatRuntime, clip: string) {
  for (const u of rt.units) if (u.def.kind === "clone" && u.ai) { u.ai.clip = clip; u.ai.mimic = 0.5; }
}

// ── The signature weapon's look in hand (Character.tsx HeldWeapon `paint`) ──
/** A prism crystal takes the colour of the last element cast. */
const ELEMENT_GLOW: Record<string, string> = { fire: "#ff8a3d", water: "#4fb8ff", earth: "#e0a860", wind: "#9ff0d8" };
const GEMS = ["M_Form1", "M_Form2", "M_Form3", "M_Form4", "M_Form5"];
/** Material name (M_Crystal, M_Trim, …) → its colour, glow colour and glow strength. */
export type WeaponPaint = Record<string, { color?: string; emissive?: string; intensity?: number }>;
const PAINT: WeaponPaint = {};
/**
 * The held signature weapon's paint (one reused object): the crystal to your last element; the charm's form gems lit
 * when learned and bright for the form you're in; the mastery trim (13, its glow at 19). Null outside classes v2.
 */
export function signaturePaint(): WeaponPaint | null {
  const v = combat.rt.v2;
  if (!v) return null;
  for (const k in PAINT) delete PAINT[k];
  const last = v.element?.split("+").pop();
  if (last && ELEMENT_GLOW[last]) PAINT.M_Crystal = { emissive: ELEMENT_GLOW[last], intensity: 1.4 };
  v.kit.keys.forEach((a, i) => {
    if (!a.group || i >= GEMS.length) return;
    const form = a.key.split(".").pop(), learnt = v.keys[i] !== null;
    PAINT[GEMS[i]] = { intensity: !learnt ? 0.03 : v.form === form || v.form === "chimera" ? 2.2 : 0.7 };
  });
  if (v.kit.look.trim && v.skin === "mastery:trim") {
    for (const [name, color] of Object.entries(v.kit.look.trim)) PAINT[name] = { color };
    if (v.mastery >= 19) for (const name of ["M_Glow", "M_Rune", "M_Crystal"]) PAINT[name] = { ...PAINT[name], intensity: Math.max(PAINT[name]?.intensity ?? 0, 2) };
  }
  const bought = v.skin ? WEAPON_SKINS[`${v.kit.key}:${v.skin}`] : undefined; // a shop skin: its material set, every tier
  if (bought) for (const [name, color] of Object.entries(bought)) PAINT[name] = { ...PAINT[name], color };
  return PAINT;
}

/** Points for an alternated element (an `attunement` passive): a cast whose elements differ from the last cast's. */
export function attune(rt: CombatRuntime, elements: string[]) {
  const v = rt.v2;
  if (!v) return;
  const key = elements.join("+");
  if (v.passive.kind === "attunement" && v.element && v.element !== key) chargeUlt(rt, v.passive.value);
  v.element = key;
}

export const zoneHas = inZone;
