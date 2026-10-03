/**
 * Field primitives (classes v2; lib/combat/wardenData.ts `FieldEffect`): what stays after a cast. Shared, one rule each,
 * each with its tests (field.test.ts):
 * - zones: ground areas that pulse (damage, slow, hold, a sink), heal you while you stand in them, drain into health,
 *   count as growth; at you (following you), at the aim, or a line behind a dash;
 * - walls: a line enemies can't walk or shoot through, cutting and slowing what touches it;
 * - channels: effects again and again toward your current aim; pulls: an enemy dragged to you;
 * - thrown units in flight; roots; tethers (a vine you swing on while the key is held); fades (and the rabbit floods
 *   they pour out); the Overgrowth and Blessed regeneration.
 * Pure over the runtime like abilities.ts. Its state lives per runtime in a WeakMap (the shared runtime type stays as it
 * is): `field(rt)` for the renderer (WardenRender.tsx). The totems' and the beasts' own behaviour is in totems.ts and
 * beasts.ts, stepped from here; stepField runs from the class layer every frame (classRuntime.ts stepClass).
 */
import type { FieldEffect } from "@/lib/combat/wardenData";
import { healedCharge } from "@/lib/combat/ult";
import { applyStatus, chargeUlt, floater, fx, runEffects, strike, summon, type Ctx } from "./abilities";
import type { CombatRuntime, ImpactTier } from "./runtime";
import { segDist, type Enemy, type Vec } from "./sim";
import { addKick } from "./moveHooks";
import { awaken, overcharge, resetTotems, stepTotems } from "./totems";
import { resetBeasts, rise, stepBeasts } from "./beasts";

export interface Zone {
  id: number; key: string; x: number; z: number;
  /** A line zone (a dash's trail): its two ends; the zone is everything within `radius` of the segment. */
  line: [Vec, Vec] | null;
  radius: number; life: number; t: number; every: number; next: number;
  power: number; slow: number; hold: number; heal: number; drain: number; growth: boolean; sink: boolean; follow: boolean;
  /** The cast's context (stat, tier, potencies, ult) its pulses strike and heal with; when its look is thrown again. */
  ctx: Ctx; look: number;
}
export interface Wall { id: number; a: Vec; b: Vec; life: number; t: number; every: number; next: number; power: number; slow: number; ctx: Ctx }
export interface Channel { key: string; life: number; t: number; every: number; next: number; effects: FieldChannelEffects; ctx: Ctx }
type FieldChannelEffects = Extract<FieldEffect, { kind: "channel" }>["effects"];
export interface Flight { id: number; unit: string; from: Vec; to: Vec; t: number; life: number; power: number; hold: number; radius: number; ctx: Ctx; source: string }
export interface Tether { x: number; z: number; pull: number; key: string; t: number }
/** A rabbit flood (Escape Rabbits): one instanced effect, `count` rabbits scattering from (x, z) over its life. */
export interface Flood { x: number; z: number; t: number; seed: number; count: number; dir: number }
export interface FieldState {
  zones: Zone[]; walls: Wall[]; channel: Channel | null; flights: Flight[]; tether: Tether | null; floods: Flood[];
  /** Seconds you stay rooted (World Tree) and translucent (Escape Rabbits). */
  rooted: number; fade: number;
}

/** A flood plays this long; a zone's look (FX recipe of the same key) is thrown again this often (decals live ≤ 4 s). */
export const FIELD = { flood: 1.6, lookEvery: 2.4, wallReach: 0.6, wallBlock: 0.45, tetherDone: 1.2, pullStop: 1.3 } as const;

const STATE = new WeakMap<CombatRuntime, FieldState>();
const empty = (): FieldState => ({ zones: [], walls: [], channel: null, flights: [], tether: null, floods: [], rooted: 0, fade: 0 });
export function field(rt: CombatRuntime): FieldState {
  let f = STATE.get(rt);
  if (!f) STATE.set(rt, f = empty());
  return f;
}
/** The encounter reset (a defeat, the scene's start): nothing on the ground, nothing held. */
export function resetField(rt: CombatRuntime) { STATE.set(rt, empty()); resetTotems(rt); resetBeasts(rt); }

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const live = (e: Enemy) => e.state !== "dead" && e.state !== "return";
/** Inside a zone: its circle, or within its radius of its line. */
export const inZone = (z: Zone, p: Vec, r = 0) => (z.line ? segDist(p, z.line[0], z.line[1]) : Math.hypot(p.x - z.x, p.z - z.z)) <= z.radius + r;
/** Standing in your own growth (Overgrowth doubles its regen there). */
export const inGrowth = (rt: CombatRuntime, me: Vec) => field(rt).zones.some(z => z.growth && inZone(z, me));
export const rooted = (rt: CombatRuntime) => field(rt).rooted > 0;
/** How solid you draw (1 solid): a fade eases in and out over a quarter second. */
export function fadeOf(rt: CombatRuntime): number {
  const f = field(rt).fade;
  return f > 0 ? 1 - 0.65 * Math.min(1, f / 0.25) : 1;
}

/**
 * The enemy a pull or an entry goes for: the live one nearest the aim within `near` of it (and `range` of you), else the
 * nearest within `range` in front of you.
 */
export function targetNear(rt: CombatRuntime, me: Vec, aim: Vec, range: number, near = 3): Enemy | null {
  let best: Enemy | null = null, bd = near;
  for (const e of rt.enemies) { if (!live(e) || dist(e, me) > range) continue; const d = dist(e, aim); if (d < bd) { bd = d; best = e; } }
  if (best) return best;
  const face = Math.atan2(aim.x - me.x, aim.z - me.z);
  bd = range;
  for (const e of rt.enemies) {
    if (!live(e)) continue;
    const d = dist(e, me), off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.x - me.x, e.z - me.z) - face), Math.cos(Math.atan2(e.x - me.x, e.z - me.z) - face)));
    if (d < bd && off < 0.6) { bd = d; best = e; }
  }
  return best;
}
/** Drag an enemy to `to` (a knock it slides on, walls stop it; the boss and mini-bosses don't budge, elites go halfway), hold it, hit it. */
export function pullEnemy(rt: CombatRuntime, e: Enemy, to: Vec, hold: number, power: number, ctx: Ctx, random: () => number) {
  const d = dist(e, to), k = e.type.kind === "boss" || e.type.miniboss ? 0 : e.type.elite ? 0.5 : 1;
  if (power > 0) strike(rt, e, { power: power * ctx.dmg, from: to, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact ?? "ability", ult: ctx.ult, knock: 0, first: true }, random);
  if (d > FIELD.pullStop && k > 0 && live(e)) { e.kx = ((to.x - e.x) / d) * 8 * (d - FIELD.pullStop) * k; e.kz = ((to.z - e.z) / d) * 8 * (d - FIELD.pullStop) * k; } // the knock slides v/8 u
  if (hold > 0 && live(e)) applyStatus(e, { hold }, ctx.ctl);
}

/** The context a zone or wall keeps: its own copy (the cast's object is reused by what follows it). */
const keep = (ctx: Ctx, at?: Vec): Ctx => ({ ...ctx, pos: { ...(at ?? ctx.pos) }, aim: { ...ctx.aim }, dir: { ...ctx.dir } });

/** A field effect from runEffects (abilities.ts). */
export function runField(rt: CombatRuntime, ef: FieldEffect, ctx: Ctx, random: () => number) {
  const f = field(rt);
  switch (ef.kind) {
    case "zone": {
      const at = ef.at === "aim" ? ctx.aim : ctx.pos;
      const line: [Vec, Vec] | null = ef.at === "path" ? [{ x: ctx.pos.x - ctx.dir.x * (ef.length ?? 4), z: ctx.pos.z - ctx.dir.z * (ef.length ?? 4) }, { ...ctx.pos }] : null;
      f.zones = f.zones.filter(z => z.key !== ef.key); // one per key: a new one replaces the old
      const z: Zone = { id: rt.seq++, key: ef.key, x: at.x, z: at.z, line, radius: ef.radius, life: ef.duration, t: 0, every: ef.every ?? 1, next: 0,
        power: ef.power ?? 0, slow: ef.slow ?? 0, hold: ef.hold ?? 0, heal: ef.heal ?? 0, drain: ef.drain ?? 0, growth: !!ef.growth, sink: !!ef.sink, follow: !!ef.follow,
        ctx: keep(ctx, at), look: 0 };
      f.zones.push(z);
      return;
    }
    case "pull": {
      const e = targetNear(rt, ctx.pos, ctx.aim, ef.range);
      if (!e) { floater(rt, ctx.pos, 1.9, "Nothing to pull", "info"); return; }
      pullEnemy(rt, e, { x: ctx.pos.x + ctx.dir.x * FIELD.pullStop, z: ctx.pos.z + ctx.dir.z * FIELD.pullStop }, ef.hold ?? 0, ef.power ?? 0, ctx, random);
      fx(rt, ctx.fx?.impact, "impact", e, ctx.pos, ctx.impact ?? "ability");
      return;
    }
    case "throw": {
      const to = ef.at === "self" ? { ...ctx.pos } : { ...ctx.aim };
      const fl: Flight = { id: rt.seq++, unit: ef.unit, from: { ...ctx.pos }, to, t: 0, life: ef.flight, power: ef.power, hold: ef.hold, radius: ef.radius, ctx: keep(ctx), source: ctx.ability.key };
      if (ef.flight <= 0) land(rt, fl, random); else f.flights.push(fl);
      return;
    }
    case "channel":
      f.channel = { key: ctx.ability.key, life: ef.duration, t: 0, every: ef.every, next: 0, effects: ef.effects, ctx: keep(ctx) };
      return;
    case "wall": {
      const px = -ctx.dir.z, pz = ctx.dir.x, h = ef.length / 2, c = ctx.aim;
      f.walls = f.walls.filter(w => w.ctx.ability.key !== ctx.ability.key);
      f.walls.push({ id: rt.seq++, a: { x: c.x + px * h, z: c.z + pz * h }, b: { x: c.x - px * h, z: c.z - pz * h }, life: ef.duration, t: 0, every: ef.every, next: 0, power: ef.power, slow: ef.slow, ctx: keep(ctx, c) });
      fx(rt, ctx.fx?.impact, "impact", c, { x: c.x + ctx.dir.x, z: c.z + ctx.dir.z }, ctx.impact ?? "ability", ef.length / 2);
      return;
    }
    case "root": f.rooted = Math.max(f.rooted, ef.duration); return;
    case "tether": {
      const d = Math.min(ef.range, dist(ctx.pos, ctx.aim));
      f.tether = { x: ctx.pos.x + ctx.dir.x * d, z: ctx.pos.z + ctx.dir.z * d, pull: ef.pull, key: ctx.ability.key, t: 0 };
      return;
    }
    case "fade":
      f.fade = Math.max(f.fade, ef.duration);
      if (ef.rabbits) { f.floods.push({ x: ctx.pos.x, z: ctx.pos.z, t: 0, seed: rt.seq++, count: ef.rabbits, dir: Math.atan2(ctx.dir.x, ctx.dir.z) }); if (f.floods.length > 4) f.floods.shift(); }
      return;
    case "overcharge": overcharge(rt, ef, ctx, random); return;
    case "awaken": awaken(rt, ef, ctx, random); return;
    case "rise": rise(rt, ef, ctx, random); return;
  }
}

/** A thrown unit lands: it plants (a summon at its spot) and hits what it lands on. */
function land(rt: CombatRuntime, fl: Flight, random: () => number) {
  const c = fl.ctx;
  summon(rt, fl.unit, 1, { ...c, aim: fl.to }, fl.source);
  let first = true;
  if (fl.radius > 0) for (const e of rt.enemies) if (live(e) && dist(e, fl.to) <= fl.radius + e.type.radius) {
    if (fl.power > 0) { strike(rt, e, { power: fl.power * c.dmg, from: fl.to, stat: c.stat, tier: c.tier, impact: c.impact ?? "ability", ult: c.ult, knock: 1.5, first }, random); first = false; }
    if (fl.hold > 0 && live(e)) applyStatus(e, { hold: fl.hold }, c.ctl);
  }
  fx(rt, c.fx?.impact, "impact", fl.to, fl.from, c.impact ?? "ability", Math.max(0.6, fl.radius));
}

/** A wall in the way of an enemy body at (x, z) of radius r (the encounter's movement check). */
export function walled(rt: CombatRuntime, x: number, z: number, r: number): boolean {
  const ws = STATE.get(rt)?.walls;
  if (!ws?.length) return false;
  for (const w of ws) if (segDist({ x, z }, w.a, w.b) < FIELD.wallBlock + r) return true;
  return false;
}
/** An enemy shot stopped by a wall this frame (its step from → to crosses one, or ends against it). */
export function wallStops(rt: CombatRuntime, from: Vec, to: Vec): boolean {
  const ws = STATE.get(rt)?.walls;
  if (!ws?.length) return false;
  for (const w of ws) if (segDist(to, w.a, w.b) < 0.3 || crosses(from, to, w.a, w.b)) return true;
  return false;
}
const side = (a: Vec, b: Vec, p: Vec) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const crosses = (p1: Vec, p2: Vec, q1: Vec, q2: Vec) => side(p1, p2, q1) * side(p1, p2, q2) < 0 && side(q1, q2, p1) * side(q1, q2, p2) < 0;

const PULSE: ImpactTier = "light";
/** One frame of the field: zones pulse, walls cut, the channel fires, flights land, the tether swings you, regen, then totems and beasts. */
export function stepField(rt: CombatRuntime, me: Vec, dt: number, random: () => number = Math.random) {
  const f = field(rt), p = rt.player;
  // Zones.
  for (let i = f.zones.length - 1; i >= 0; i--) {
    const z = f.zones[i];
    if (z.follow) { z.x = me.x; z.z = me.z; }
    if ((z.look -= dt) <= 0) { // its look, thrown again while it stays (decals live at most 4 s)
      z.look = FIELD.lookEvery;
      if (z.line) for (let k = 0, n = Math.max(1, Math.round(dist(z.line[0], z.line[1]))); k <= n; k++) {
        const u = k / n; fx(rt, z.key, "zone", { x: z.line[0].x + (z.line[1].x - z.line[0].x) * u, z: z.line[0].z + (z.line[1].z - z.line[0].z) * u }, z.line[1], z.ctx.impact ?? "ability", z.radius);
      }
      else fx(rt, z.key, "zone", z, z.ctx.aim, z.ctx.impact ?? "ability", z.radius);
    }
    z.t += dt;
    if (z.t >= z.life) { f.zones.splice(i, 1); continue; }
    if ((z.next -= dt) > 0 || !p.alive) continue;
    z.next += z.every;
    const sinking = z.sink && z.t > z.life * 0.7;
    let dealt = 0;
    for (const e of rt.enemies) {
      if (!live(e) || !inZone(z, e, e.type.radius)) continue;
      if (z.power > 0) dealt += strike(rt, e, { power: z.power * z.ctx.dmg, from: z.line ? e : z, stat: z.ctx.stat, tier: z.ctx.tier, impact: PULSE, ult: z.ctx.ult, knock: 0 }, random);
      if (!live(e)) continue;
      if (z.slow > 0 || z.sink) applyStatus(e, { slow: [z.sink ? Math.max(z.slow, 0.6) : z.slow, z.every + 0.25] });
      if (z.hold > 0 || sinking) applyStatus(e, { hold: sinking ? z.every + 0.2 : z.hold }, z.ctx.ctl);
    }
    if (z.drain > 0 && dealt > 0) gain(rt, dealt * z.drain);
    if (z.heal > 0 && inZone(z, me)) gain(rt, p.maxHp * z.heal * z.every * z.ctx.sup);
  }
  // Walls.
  for (let i = f.walls.length - 1; i >= 0; i--) {
    const w = f.walls[i];
    if ((w.t += dt) >= w.life) { f.walls.splice(i, 1); continue; }
    if ((w.next -= dt) > 0) continue;
    w.next += w.every;
    for (const e of rt.enemies) {
      if (!live(e) || segDist(e, w.a, w.b) > FIELD.wallReach + e.type.radius) continue;
      if (w.power > 0) strike(rt, e, { power: w.power * w.ctx.dmg, from: e, stat: w.ctx.stat, tier: w.ctx.tier, impact: PULSE, ult: w.ctx.ult, knock: 0 }, random);
      if (live(e) && w.slow > 0) applyStatus(e, { slow: [w.slow, w.every + 0.3] });
    }
  }
  // The channel: its effects toward your current aim, until it runs out, you dodge or you fall.
  const ch = f.channel;
  if (ch) {
    ch.t += dt;
    if (ch.t > ch.life || !p.alive || p.dodgeAge !== null) f.channel = null;
    else if ((ch.next -= dt) <= 0) {
      ch.next += ch.every;
      const d = Math.hypot(p.aim.x - me.x, p.aim.z - me.z), dir = d > 0.05 ? { x: (p.aim.x - me.x) / d, z: (p.aim.z - me.z) / d } : ch.ctx.dir;
      p.facing = Math.atan2(dir.x, dir.z); p.aimHold = Math.max(p.aimHold, 0.35);
      runEffects(rt, ch.effects, { ...ch.ctx, pos: { x: me.x, z: me.z }, aim: { x: p.aim.x, z: p.aim.z }, dir }, random);
    }
  }
  // Thrown units in flight.
  for (let i = f.flights.length - 1; i >= 0; i--) { const fl = f.flights[i]; if ((fl.t += dt) >= fl.life) { f.flights.splice(i, 1); land(rt, fl, random); } }
  // The tether: while its key is held you swing toward the anchor; let go (or arrive) and it's gone.
  const te = f.tether;
  if (te) {
    const v = rt.v2, slot = v ? v.keys.findIndex(a => a?.key === te.key) : -1, d = Math.hypot(te.x - me.x, te.z - me.z);
    te.t += dt;
    if (!p.alive || slot < 0 || v!.holding[slot] === null || d < FIELD.tetherDone) f.tether = null;
    else p.kick = addKick(p.kick, (te.x - me.x) / d, (te.z - me.z) / d, te.pull * dt, 0);
  }
  f.rooted = Math.max(0, f.rooted - dt); f.fade = Math.max(0, f.fade - dt);
  for (let i = f.floods.length - 1; i >= 0; i--) if ((f.floods[i].t += dt) > FIELD.flood) f.floods.splice(i, 1);
  // Overgrowth and Blessed: regeneration (healing power raises it; it heals, it never turns into a shield).
  const pv = rt.v2?.passive;
  if (p.alive && pv && (pv.kind === "overgrowth" || pv.kind === "blessed")) {
    const rate = pv.value * (pv.kind === "overgrowth" && inGrowth(rt, me) ? 2 : 1) * (rt.v2!.mods.healing ?? 1);
    gain(rt, p.maxHp * rate * dt, false);
  }
  stepTotems(rt, me, dt, random);
  stepBeasts(rt, me, dt, random);
}

/** Health back (lifesteal, a zone's heal, regen): it charges the meter like any heal (§1.2); past full it's lost. */
function gain(rt: CombatRuntime, amount: number, show = true) {
  const p = rt.player;
  if (!p.alive || amount <= 0) return 0;
  const got = Math.min(amount, p.maxHp - p.hp);
  if (got <= 0) return 0;
  p.hp += got;
  chargeUlt(rt, healedCharge(got, p.maxHp));
  if (show && got >= 1) floater(rt, rt.player.last ?? { x: 0, z: 0 }, 2.1, `+${Math.round(got)}`, "info");
  return got;
}
