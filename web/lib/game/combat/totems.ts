/**
 * The Shaman's totems (classes v2, the Warden wave; design sheet "Shaman (LOCKED)"). Thrown like grenades (field.ts
 * `throw`), they plant where they land and fire on their own: the storm totem zaps the nearest enemy, the fire totem
 * bursts in flame round itself, the earthbind totem slows everything round it and roots it now and then. Totems within
 * link range of each other draw lightning between them that cuts what crosses it; the links' shape encloses enemies
 * (inside the hull of three or more, or along the line of two), and Overcharge unloads every linked totem at once, ×
 * more for each enemy enclosed. Resonance: each link a totem holds raises its damage. Spirit Awakening plants any
 * missing totem round the aim and raises each totem's spirit: the thunderbird, the salamander and the bear.
 * Totems and spirits are units (`driven`: this module moves and fights them; the shared AI only ages them). Radii and
 * the link range grow with the area stat. Per-runtime state in a WeakMap; WardenRender.tsx draws the links and zaps.
 */
import type { FieldEffect } from "@/lib/combat/wardenData";
import { applyStatus, floater, fx, strike, summon, type Ctx } from "./abilities";
import type { CombatRuntime, Unit } from "./runtime";
import { segDist, type Enemy, type Vec } from "./sim";
import { rankScale } from "./field";

export const TOTEM = {
  /** Link range (× area): two totems closer than this draw lightning between them. */
  link: 9,
  beam: { every: 0.5, power: 0.1, width: 0.55 },
  storm: { every: 0.9, power: 0.18 },
  fire: { every: 1.6, power: 0.22 },
  earth: { every: 0.5, slow: 0.3, root: 5, hold: 0.45 },
  /** Along a line of two, enemies this close to it count as enclosed. */
  enclose: 1.2,
  thunderbird: { every: 0.5, power: 0.7, reach: 7, orbit: 1.6 },
  salamander: { every: 0.3, power: 0.4, reach: 1.3, hunt: 8 },
  bear: { every: 1.4, power: 1.1, radius: 2.4, hold: 0.5, hunt: 7 },
} as const;
const KINDS = ["totem-storm", "totem-fire", "totem-earth"] as const;
const SPIRIT: Record<(typeof KINDS)[number], string> = { "totem-storm": "spirit-thunderbird", "totem-fire": "spirit-salamander", "totem-earth": "spirit-bear" };
/** Which key throws each totem (Awakening plants missing ones as if thrown, so re-throwing replaces them). */
const THROWN_BY: Record<(typeof KINDS)[number], string> = { "totem-storm": "shaman.storm", "totem-fire": "shaman.fire", "totem-earth": "shaman.earth" };

export interface Zap { from: Vec; to: Vec; t: number }
export interface TotemState {
  /** This frame's links (pairs of totems) and how many each totem holds. */
  links: [Unit, Unit][]; held: Map<Unit, number>;
  /** Enemies inside the links' shape now. */
  enclosed: number;
  beamT: number; earthT: Map<Unit, number>;
  /** Recent zaps (storm totem, thunderbird) for the renderer, and the links' flash after an Overcharge (seconds). */
  zaps: Zap[]; flash: number;
  /** Awakening: the ult's context its spirits strike with, and the spirits' own timers. */
  ult: Ctx | null; spiritCd: Map<Unit, number>;
}
const STATE = new WeakMap<CombatRuntime, TotemState>();
const fresh = (): TotemState => ({ links: [], held: new Map(), enclosed: 0, beamT: 0, earthT: new Map(), zaps: [], flash: 0, ult: null, spiritCd: new Map() });
export function totemState(rt: CombatRuntime): TotemState {
  let s = STATE.get(rt);
  if (!s) STATE.set(rt, s = fresh());
  return s;
}
export const resetTotems = (rt: CombatRuntime) => { STATE.set(rt, fresh()); };

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const live = (e: Enemy) => e.state !== "dead" && e.state !== "return";
export const isTotem = (u: Unit) => u.def.kind === "totem" && !!u.def.driven;
const area = (rt: CombatRuntime) => rt.v2?.mods.area ?? 1;
/** Resonance: a totem's damage × (1 + value per link it holds). */
const resonance = (rt: CombatRuntime, s: TotemState, u: Unit) => { const pv = rt.v2?.passive; return 1 + (pv?.kind === "links" ? pv.value * (s.held.get(u) ?? 0) : 0); };

/** Links between totems in range of each other (each pair once), and how many each holds. */
export function linksOf(totems: Unit[], range: number): { links: [Unit, Unit][]; held: Map<Unit, number> } {
  const links: [Unit, Unit][] = [], held = new Map<Unit, number>();
  for (let i = 0; i < totems.length; i++) for (let j = i + 1; j < totems.length; j++) {
    if (dist(totems[i], totems[j]) > range) continue;
    links.push([totems[i], totems[j]]);
    held.set(totems[i], (held.get(totems[i]) ?? 0) + 1); held.set(totems[j], (held.get(totems[j]) ?? 0) + 1);
  }
  return { links, held };
}
/** The convex hull of points (counter-clockwise), for the shape three or more linked totems enclose. */
export function hull(pts: Vec[]): Vec[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  if (p.length < 3) return p;
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: Vec[] = [], upper: Vec[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const inside = (poly: Vec[], q: Vec) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > q.z) !== (b.z > q.z) && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};
/** Enemies the links enclose: inside the hull of the linked totems (three or more), or along the one line of two. */
export function enclosed(enemies: Enemy[], links: [Unit, Unit][]): Enemy[] {
  if (!links.length) return [];
  const pts = [...new Set(links.flat())];
  if (pts.length >= 3) { const h = hull(pts); return enemies.filter(e => live(e) && inside(h, e)); }
  const [a, b] = links[0];
  return enemies.filter(e => live(e) && segDist(e, a, b) <= TOTEM.enclose + e.type.radius);
}

/** Overcharge (and the Awakening's eruption): every linked totem bursts and every link flashes, ×(1 + per × enclosed). */
export function overcharge(rt: CombatRuntime, ef: Extract<FieldEffect, { kind: "overcharge" }>, ctx: Ctx, random: () => number) {
  const s = totemState(rt), totems = rt.units.filter(isTotem);
  const { links, held } = linksOf(totems, TOTEM.link * area(rt));
  s.links = links; s.held = held;
  const linked = totems.filter(u => (held.get(u) ?? 0) > 0);
  if (!linked.length) { floater(rt, ctx.pos, 1.9, "No linked totems", "info"); return; }
  const n = enclosed(rt.enemies, links).length, mult = Math.min(ef.max, 1 + ef.per * n);
  let first = true;
  for (const u of linked) {
    for (const e of rt.enemies) if (live(e) && dist(e, u) <= ef.radius + e.type.radius) {
      strike(rt, e, { power: ef.power * ctx.dmg * resonance(rt, s, u) * mult, from: u, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact, ult: ctx.ult, knock: 3, first }, random);
      first = false;
    }
    fx(rt, ctx.fx?.impact, "impact", u, ctx.pos, ctx.impact ?? "heavy", ef.radius);
  }
  const hit = new Set<Enemy>();
  for (const [a, b] of links) for (const e of rt.enemies) if (live(e) && !hit.has(e) && segDist(e, a, b) <= TOTEM.beam.width + e.type.radius) {
    hit.add(e);
    strike(rt, e, { power: ef.link * ctx.dmg * mult, from: e, stat: ctx.stat, tier: ctx.tier, impact: ctx.impact, ult: ctx.ult, knock: 1 }, random);
  }
  s.flash = 0.4;
  floater(rt, ctx.pos, 2.2, n ? `Overcharge ×${mult.toFixed(1)} · ${n} enclosed` : "Overcharge", "info");
}

/** Spirit Awakening: missing totems planted round the aim (a triangle `ring` out), then each totem's spirit rises for `duration` s. */
export function awaken(rt: CombatRuntime, ef: Extract<FieldEffect, { kind: "awaken" }>, ctx: Ctx, random: () => number) {
  const s = totemState(rt);
  KINDS.forEach((kind, i) => {
    if (rt.units.some(u => u.def.key === kind)) return;
    const a = (i / 3) * Math.PI * 2 + Math.atan2(ctx.dir.x, ctx.dir.z), at = { x: ctx.aim.x + Math.sin(a) * ef.ring, z: ctx.aim.z + Math.cos(a) * ef.ring };
    summon(rt, kind, 1, { ...ctx, aim: at }, THROWN_BY[kind]);
    fx(rt, "shaman.plant", "impact", at, ctx.pos, "ability", 1);
  });
  s.ult = { ...ctx, pos: { ...ctx.pos }, aim: { ...ctx.aim }, dir: { ...ctx.dir } };
  for (const t of rt.units.filter(u => (KINDS as readonly string[]).includes(u.def.key))) {
    summon(rt, SPIRIT[t.def.key as (typeof KINDS)[number]], 1, { ...ctx, pos: { x: t.x, z: t.z }, aim: { x: t.x, z: t.z } }, "shaman.ult");
    const sp = rt.units[rt.units.length - 1];
    if (sp?.def.key.startsWith("spirit-")) { sp.life = ef.duration; sp.x = t.x; sp.z = t.z; s.spiritCd.set(sp, 0.3); }
  }
  void random;
}

/** One frame: links and what they enclose, the beams' cuts, each totem's own attack, the spirits. */
export function stepTotems(rt: CombatRuntime, me: Vec, dt: number, random: () => number) {
  const s = STATE.get(rt);
  const totems = rt.units.filter(isTotem);
  if (!totems.length && !s) return;
  const st = s ?? totemState(rt), A = area(rt);
  const { links, held } = linksOf(totems, TOTEM.link * A);
  st.links = links; st.held = held;
  st.enclosed = links.length ? enclosed(rt.enemies, links).length : 0;
  st.flash = Math.max(0, st.flash - dt);
  for (let i = st.zaps.length - 1; i >= 0; i--) if ((st.zaps[i].t += dt) > 0.18) st.zaps.splice(i, 1);
  if (dt <= 0) return;
  // The lightning between linked totems cuts what crosses it.
  if (links.length && (st.beamT -= dt) <= 0) {
    st.beamT = TOTEM.beam.every;
    const hit = new Set<Enemy>();
    for (const [a, b] of links) {
      const res = (resonance(rt, st, a) + resonance(rt, st, b)) / 2;
      for (const e of rt.enemies) if (live(e) && !hit.has(e) && segDist(e, a, b) <= TOTEM.beam.width + e.type.radius) {
        hit.add(e);
        strike(rt, e, { power: TOTEM.beam.power * res, from: e, stat: a.stat, unit: true, knock: 0 }, random);
      }
    }
  }
  for (const u of totems) {
    const key = u.def.key, r = (u.def.radius ?? 0) * A * rankScale(rt, u.source, "radius"), res = resonance(rt, st, u) * rankScale(rt, u.source, "power"); // its key's ranks
    if (u.body) { u.body.x = u.x; u.body.z = u.z; u.body.t += dt; }
    if (key === "totem-earth") {
      for (const e of rt.enemies) if (live(e) && dist(e, u) <= r + e.type.radius) applyStatus(e, { slow: [TOTEM.earth.slow, 0.7] });
      const t = (st.earthT.get(u) ?? TOTEM.earth.root) - dt;
      st.earthT.set(u, t > 0 ? t : TOTEM.earth.root);
      if (t <= 0) {
        for (const e of rt.enemies) if (live(e) && dist(e, u) <= r + e.type.radius) applyStatus(e, { hold: TOTEM.earth.hold });
        fx(rt, "shaman.quake", "impact", u, me, "ability", r);
        pose(u, "slam");
      }
      continue;
    }
    if (u.cd > 0) { if (u.cd < 0.3) pose(u, "windup"); continue; }
    if (key === "totem-storm") {
      let best: Enemy | null = null, bd = r;
      for (const e of rt.enemies) { const d = live(e) ? dist(e, u) : Infinity; if (d <= bd + e.type.radius) { bd = d; best = e; } }
      if (!best) continue;
      u.cd = TOTEM.storm.every;
      strike(rt, best, { power: TOTEM.storm.power * res, from: u, stat: u.stat, unit: true, knock: 0.5 }, random);
      st.zaps.push({ from: { x: u.x, z: u.z }, to: { x: best.x, z: best.z }, t: 0 });
      fx(rt, "shaman.zap", "impact", best, u, "light");
      pose(u, "recover");
    } else if (key === "totem-fire") {
      if (!rt.enemies.some(e => live(e) && dist(e, u) <= r + e.type.radius)) continue;
      u.cd = TOTEM.fire.every;
      for (const e of rt.enemies) if (live(e) && dist(e, u) <= r + e.type.radius) strike(rt, e, { power: TOTEM.fire.power * res, from: u, stat: u.stat, unit: true, knock: 1 }, random);
      fx(rt, "shaman.flame", "impact", u, me, "light", r);
      pose(u, "recover");
    }
  }
  stepSpirits(rt, st, me, dt, random);
}
/** A totem body's pulse for the renderer: its telegraph glow swells before it fires (windup) and settles after. */
function pose(u: Unit, state: "windup" | "recover" | "slam") {
  const b = u.body;
  if (!b) return;
  if (state === "slam") { b.state = "recover"; b.t = 0; return; }
  if (b.state !== state) { b.state = state; b.t = 0; }
}

/** The risen spirits: the thunderbird circles its totem and strikes lightning, the salamander runs through enemies, the bear slams. Their hits are the ult's. */
function stepSpirits(rt: CombatRuntime, st: TotemState, me: Vec, dt: number, random: () => number) {
  const c = st.ult;
  for (const u of rt.units) {
    if (!u.def.key.startsWith("spirit-") || !c) continue;
    const home = rt.units.find(t => t.def.key === (u.def.key === "spirit-thunderbird" ? "totem-storm" : u.def.key === "spirit-salamander" ? "totem-fire" : "totem-earth")) ?? u;
    const cd = (st.spiritCd.get(u) ?? 0) - dt;
    st.spiritCd.set(u, cd);
    const hit = (e: Enemy, power: number, knock: number, hold = 0) => {
      strike(rt, e, { power: power * c.dmg, from: u, stat: c.stat, tier: c.tier, impact: "ability", ult: true, knock }, random);
      if (hold && live(e)) applyStatus(e, { hold });
    };
    const nearest = (from: Vec, reach: number) => { let b: Enemy | null = null, bd = reach; for (const e of rt.enemies) { const d = live(e) ? dist(e, from) : Infinity; if (d < bd) { bd = d; b = e; } } return b; };
    const move = (to: Vec, speed: number) => { const d = dist(to, u); if (d > 0.6) { const k = Math.min(d - 0.6, speed * dt) / d; u.x += (to.x - u.x) * k; u.z += (to.z - u.z) * k; } };
    if (u.def.key === "spirit-thunderbird") {
      const a = (u.life ?? 0) * 1.6;
      u.x = home.x + Math.sin(a) * TOTEM.thunderbird.orbit; u.z = home.z + Math.cos(a) * TOTEM.thunderbird.orbit;
      const e = cd <= 0 ? nearest(u, TOTEM.thunderbird.reach * area(rt)) : null;
      if (e) { st.spiritCd.set(u, TOTEM.thunderbird.every); hit(e, TOTEM.thunderbird.power, 1); st.zaps.push({ from: { x: u.x, z: u.z }, to: { x: e.x, z: e.z }, t: 0 }); fx(rt, "shaman.zap", "impact", e, u, "ability"); }
    } else if (u.def.key === "spirit-salamander") {
      const e = nearest(home, TOTEM.salamander.hunt * area(rt));
      if (e) move(e, (u.def.speed ?? 7) * 1);
      if (cd <= 0) {
        st.spiritCd.set(u, TOTEM.salamander.every);
        for (const f of rt.enemies) if (live(f) && dist(f, u) <= TOTEM.salamander.reach + f.type.radius) hit(f, TOTEM.salamander.power, 0.5);
        fx(rt, "shaman.trailFire", "zone", u, me, "light", 0.8);
      }
    } else if (u.def.key === "spirit-bear") {
      const e = nearest(home, TOTEM.bear.hunt * area(rt));
      if (e) move(e, u.def.speed ?? 4.5);
      if (cd <= 0 && e && dist(e, u) <= TOTEM.bear.radius) {
        st.spiritCd.set(u, TOTEM.bear.every);
        for (const f of rt.enemies) if (live(f) && dist(f, u) <= TOTEM.bear.radius * area(rt) + f.type.radius) hit(f, TOTEM.bear.power, 3, TOTEM.bear.hold);
        fx(rt, "shaman.slam", "impact", u, me, "heavy", TOTEM.bear.radius);
        if (u.body) { u.body.state = "recover"; u.body.t = 0; u.body.move = { ...u.body.move, shape: "slam" }; }
      }
    }
    if (u.body) {
      const was = { x: u.body.x, z: u.body.z };
      u.body.x = u.x; u.body.z = u.z; u.body.t += dt;
      const moved = Math.hypot(u.x - was.x, u.z - was.z);
      if (moved > 1e-3) u.body.facing = Math.atan2(u.x - was.x, u.z - was.z);
      if (u.body.state === "recover" && u.body.t > 0.6) { u.body.state = "chase"; u.body.t = 0; }
    }
  }
  if (!rt.units.some(u => u.def.key.startsWith("spirit-"))) st.ult = null;
}
