/**
 * The Summoner's shadow beasts (classes v2, the Warden wave; design sheet "Summoner (LOCKED)", Megumi-style). Keys
 * toggle a beast in and out (the input layer's toggles; the beasts are minion units on the shared AI). This module adds
 * what makes them beasts:
 * - each enters with its signature move: the wolves pounce your target, the owl swoops and glides you forward, the
 *   toad's tongue drags your target to you, the serpent bursts from the ground under the target and stuns it;
 * - then they stay: the toad also guards you, tonguing in whatever rushes you; the owl circles above and dives;
 * - a killed beast goes on a cooldown before it can be called again, and Shadow Bond passes its strength to the others;
 * - out at once: 2, 3 at mastery 10, 4 at 20 (the wolves are a pair, half a beast each); summon power raises their
 *   damage and health;
 * - Shadow Garden (`rise`): every tamed beast rises at once past the cap, and your dash warps inside the garden;
 * - taming: wolves are known; the owl, the toad, the serpent and the rabbits are tamed in turn at the ritual circle in
 *   the outer wild, by beating each one's untamed form alone (your beasts go back to the shadows while it lasts).
 *   The taming is recorded on the server (/api/combat/tame, combat_tame_beast): the scene posts `events`.
 * Pure over the runtime; per-runtime state in WeakMaps (the shared runtime type stays as it is).
 */
import { UNITS } from "@/lib/combat/kits";
import { BEASTS, nextToTame, TAMED_AT_START, type FieldEffect } from "@/lib/combat/wardenData";
import type { ClassKit } from "@/lib/combat/classes";
import { applyStatus, floater, fx, strike, summon, type Ctx } from "./abilities";
import { ENEMIES } from "./data";
import { addKick } from "./moveHooks";
import type { CombatRuntime, Unit } from "./runtime";
import { engage, spawnEnemy, type Enemy, type Vec } from "./sim";
import { pullEnemy, rankScale, targetNear } from "./field";
import { zoneAt } from "@/lib/game/ruins";
import { equipClassKit } from "./classRuntime";

export const BEAST = {
  /** Seconds before a killed beast can be called again. */
  deathCd: 10,
  wolves: { power: 0.7, range: 9 },
  owl: { push: 4, lift: 0.9 },
  toad: { range: 9, hold: 0.8, power: 0.6 },
  serpent: { range: 10, radius: 1.6, power: 1, hold: 1.6 },
  guard: { every: 3.5, reach: 4.5, hold: 0.8, power: 0.4 },
  warp: { power: 0.8, radius: 2 },
} as const;
/**
 * The ritual circle in the outer wild's west (well inside the canyon floor: the form rises 3 u off it on open ground),
 * the ward you must stay inside, and its wait.
 */
export const RITUAL = { x: -11, z: -15.5, r: 2.2, ward: 9, wait: 1.2, limit: 150 } as const;
/** Beasts out at once by mastery (design sheet: 2 at 1, 3 at 10, 4 at 20). */
export const beastCap = (mastery: number) => (mastery >= 20 ? 4 : mastery >= 10 ? 3 : 2);

const POUNCE = { shape: "pounce" as const, windup: 0.01, active: 0.32, recover: 0.4, damage: 0, range: 1.4, arc: 0, knockback: 0, leap: 0 };
interface Tracked { base: number; key: string; entry: number }
export interface Tongue { from: Vec; to: Vec; t: number }
export interface Garden { x: number; z: number; r: number; t: number; life: number; added: Set<Unit> }
export interface Ritual { beast: string; enemy: Enemy | null; t: number }
export interface BeastState {
  tracked: Map<Unit, Tracked>;
  /** Ability key → seconds left on its death cooldown (the Shadow Bond counts these). */
  dead: Record<string, number>;
  guard: Map<Unit, number>;
  tongues: Tongue[];
  garden: Garden | null;
  ritual: Ritual | null;
  /** After a ritual ends you step out of the circle before another starts. */
  ritualArmed: boolean;
  /** Tamings for the scene to post (/api/combat/tame). */
  events: { beast: string; key: string }[];
  /** The ritual's own card on the banner, and the encounter seconds it stays (the scene's clock never clears it). */
  card: CombatRuntime["banner"]; cardLeft: number;
}
const STATE = new WeakMap<CombatRuntime, BeastState>();
const fresh = (): BeastState => ({ tracked: new Map(), dead: {}, guard: new Map(), tongues: [], garden: null, ritual: null, ritualArmed: true, events: [], card: null, cardLeft: 0 });
export function beastState(rt: CombatRuntime): BeastState {
  let s = STATE.get(rt);
  if (!s) STATE.set(rt, s = fresh());
  return s;
}
export function resetBeasts(rt: CombatRuntime) {
  const s = STATE.get(rt);
  if (s?.ritual?.enemy) rt.enemies = rt.enemies.filter(e => e !== s.ritual!.enemy);
  STATE.set(rt, { ...fresh(), events: s?.events ?? [] });
}

// ── Taming (member data: kept apart from the encounter's state, which a reset clears) ──
const TAMED = new WeakMap<CombatRuntime, Set<string>>();
/** The member's tamed beasts (from /api/combat/progression); unset (tests, the balance harness) means all of them. */
export function setTamed(rt: CombatRuntime, beasts: readonly string[] | null) {
  if (beasts) TAMED.set(rt, new Set([...TAMED_AT_START, ...beasts])); else TAMED.delete(rt);
}
export const tamedList = (rt: CombatRuntime): string[] | null => { const t = TAMED.get(rt); return t ? [...t] : null; };
export const isTamed = (rt: CombatRuntime, beast: string) => !TAMED.has(rt) || TAMED.get(rt)!.has(beast);
/** A ritual under way (the HUD: the beast keys wait for it). */
export const ritualOn = (rt: CombatRuntime) => !!STATE.get(rt)?.ritual;

/** A kit that calls beasts (the Summoner): its keys' summons name beast units. */
export const beastKit = (kit: ClassKit | null | undefined) => !!kit?.keys.some(k => k.effects.some(e => e.kind === "summon" && e.unit.startsWith("beast-")));
const isBeast = (u: Unit) => u.def.key.startsWith("beast-");
const live = (e: Enemy) => e.state !== "dead" && e.state !== "return";
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shadow Garden: every tamed beast not already out rises (past the cap) for the garden's life; the garden is where your dash warps. */
export function rise(rt: CombatRuntime, ef: Extract<FieldEffect, { kind: "rise" }>, ctx: Ctx, random: () => number) {
  const v = rt.v2, s = beastState(rt);
  if (!v) return;
  s.garden = { x: ctx.pos.x, z: ctx.pos.z, r: ef.radius, t: 0, life: ef.duration, added: new Set() };
  v.capacity = 99;
  for (const a of v.kit.keys) {
    const call = a.effects.find(e => e.kind === "summon" && e.unit.startsWith("beast-"));
    if (!call || call.kind !== "summon" || (a.tame && !isTamed(rt, a.tame)) || rt.units.some(u => u.source === a.key)) continue;
    const before = new Set(rt.units);
    summon(rt, call.unit, call.count ?? 1, ctx, a.key);
    for (const u of rt.units) if (!before.has(u)) { s.garden.added.add(u); u.ult = true; } // the ult's own: its hits are the ult's
    delete s.dead[a.key];
  }
  void random;
}

/** Your dash inside Shadow Garden: a warp to the aim (inside the garden), the shadows bursting where you come out. */
export function gardenWarp(rt: CombatRuntime, me: Vec, random: () => number = Math.random): boolean {
  const g = STATE.get(rt)?.garden, p = rt.player;
  if (!g || !p.alive) return false;
  const d = dist(p.aim, g), k = d > g.r ? g.r / d : 1, to = { x: g.x + (p.aim.x - g.x) * k, z: g.z + (p.aim.z - g.z) * k };
  if (dist(to, me) < 1) return false;
  p.kick = { ...addKick(p.kick, 0, 0, 0, 0), to };
  fx(rt, "summoner.warp", "impact", me, to, "ability", 1);
  fx(rt, "summoner.warp", "impact", to, me, "ability", BEAST.warp.radius);
  let first = true;
  for (const e of rt.enemies) if (live(e) && dist(e, to) <= BEAST.warp.radius + e.type.radius) {
    strike(rt, e, { power: BEAST.warp.power * (rt.v2?.mods.summonPower ?? 1), from: to, impact: "ability", knock: 2, first, ult: true }, random);
    first = false;
  }
  return true;
}

/** A beast's entry move, the frame after it's called (toward your aim). */
function enter(rt: CombatRuntime, u: Unit, me: Vec, index: number, random: () => number) {
  const p = rt.player, sp = (rt.v2?.mods.summonPower ?? 1) * rankScale(rt, u.source, "power"), b = u.body;
  const hit = (e: Enemy, power: number, knock: number, impact: "ability" | "heavy", first = true) =>
    strike(rt, e, { power: power * sp, from: u, stat: u.stat, impact, knock, first, ult: u.ult }, random);
  switch (u.def.key) {
    case "beast-wolf": {
      const e = targetNear(rt, me, p.aim, BEAST.wolves.range);
      if (!e) return;
      const side = index % 2 ? -1 : 1, a = Math.atan2(e.x - me.x, e.z - me.z) + side * 0.6;
      u.x = e.x - Math.sin(a) * (e.type.radius + 0.7); u.z = e.z - Math.cos(a) * (e.type.radius + 0.7);
      if (b) { b.x = u.x; b.z = u.z; b.state = "active"; b.t = 0; b.move = POUNCE; b.facing = Math.atan2(e.x - u.x, e.z - u.z); }
      hit(e, BEAST.wolves.power, 2, "ability", index === 0);
      fx(rt, "summoner.pounce", "impact", e, me, "ability", 1);
      return;
    }
    case "beast-owl": {
      const d = Math.hypot(p.aim.x - me.x, p.aim.z - me.z) || 1;
      p.kick = addKick(p.kick, (p.aim.x - me.x) / d, (p.aim.z - me.z) / d, BEAST.owl.push, BEAST.owl.lift, true);
      u.x = me.x; u.z = me.z;
      fx(rt, "summoner.swoop", "impact", me, p.aim, "ability", 1);
      return;
    }
    case "beast-toad": {
      const e = targetNear(rt, me, p.aim, BEAST.toad.range);
      if (!e) return;
      const c = ctxOf(rt, u);
      s(rt).tongues.push({ from: { x: u.x, z: u.z }, to: { x: e.x, z: e.z }, t: 0 });
      pullEnemy(rt, e, { x: me.x + Math.sin(p.facing) * 1.3, z: me.z + Math.cos(p.facing) * 1.3 }, BEAST.toad.hold, BEAST.toad.power * sp, c, random);
      fx(rt, "summoner.tongue", "impact", e, me, "ability", 1);
      return;
    }
    case "beast-serpent": {
      const e = targetNear(rt, me, p.aim, BEAST.serpent.range), at = e ? { x: e.x, z: e.z } : { ...p.aim };
      u.x = at.x; u.z = at.z;
      if (b) { b.x = at.x; b.z = at.z; b.state = "recover"; b.t = 0; b.move = { ...b.move, shape: "slam" }; }
      let first = true;
      for (const f of rt.enemies) if (live(f) && dist(f, at) <= BEAST.serpent.radius + f.type.radius) {
        hit(f, BEAST.serpent.power, 3.5, "heavy", first); first = false;
        if (live(f)) applyStatus(f, { hold: BEAST.serpent.hold });
      }
      fx(rt, "summoner.burst", "impact", at, me, "heavy", BEAST.serpent.radius);
      return;
    }
  }
}
const s = beastState;
/** A context for a beast's own pulls (its stat; control at full). */
const ctxOf = (rt: CombatRuntime, u: Unit): Ctx => ({ ability: { key: u.source, name: u.def.name, description: "", cooldown_s: 0, energy: 0, effects: [] }, pos: { x: u.x, z: u.z }, aim: { x: u.x, z: u.z },
  dir: { x: 0, z: 1 }, dmg: 1, sup: 1, ctl: 1, gear: 1, stat: u.stat, color: rt.v2?.kit.look.ramp[1] ?? "#3fd67a", impact: "ability", ult: u.ult });

/** One frame: the cap, untamed keys locked, entries, deaths and their cooldowns, Shadow Bond, the toad's guard, the garden, the ritual. */
export function stepBeasts(rt: CombatRuntime, me: Vec, dt: number, random: () => number) {
  const v = rt.v2;
  if (!v || !beastKit(v.kit)) return;
  const st = beastState(rt);
  v.capacity = st.garden ? 99 : beastCap(v.mastery);
  // Untamed beasts (and every beast while a ritual runs) can't be called.
  v.kit.keys.forEach((a, i) => {
    const locked = (a.tame && !isTamed(rt, a.tame)) || (st.ritual && a.effects.some(e => e.kind === "summon" && e.unit.startsWith("beast-")));
    if (locked && v.keys[i]) { v.keys[i] = null; v.inputKit.inputs[i] = null; }
  });
  // New beasts: tracked (their own power, health by summon power) and their entry.
  let n = 0;
  for (const u of rt.units) {
    if (!isBeast(u) || st.tracked.has(u)) continue;
    u.hp = u.maxHp = Math.round((UNITS[u.def.key]?.hp ?? u.maxHp) * v.mods.summonPower);
    u.power *= rankScale(rt, u.source, "power"); // its key's ranks
    st.tracked.set(u, { base: u.power, key: u.source, entry: 0.35 });
    enter(rt, u, me, n++, random);
  }
  // Gone: a killed beast's key goes on cooldown once the last of it is down.
  for (const [u, t] of st.tracked) {
    if (rt.units.includes(u)) {
      if (t.entry > 0 && (t.entry -= dt) <= 0 && u.body?.state === "active") { u.body.state = "chase"; u.body.t = 0; }
      continue;
    }
    st.tracked.delete(u); st.guard.delete(u);
    if (u.hp <= 0 && !rt.units.some(x => x.source === t.key)) {
      st.dead[t.key] = BEAST.deathCd;
      v.cd[t.key] = Math.max(v.cd[t.key] ?? 0, BEAST.deathCd);
      floater(rt, me, 2, `${u.def.name.replace(/^Shadow /, "")} fell · back in ${BEAST.deathCd} s`, "info");
    }
  }
  for (const k in st.dead) if ((st.dead[k] -= dt) <= 0) delete st.dead[k];
  // Shadow Bond: each fallen beast (on its cooldown) adds its share to the others.
  const pv = v.passive, fallen = pv.kind === "shadow_bond" ? Math.min(pv.cap ?? 2, Object.keys(st.dead).length) : 0;
  for (const [u, t] of st.tracked) u.power = t.base * (1 + (pv.kind === "shadow_bond" ? pv.value * fallen : 0));
  // The toad guards you: whatever rushes you is tongued in to it.
  for (const u of rt.units) {
    if (u.def.key !== "beast-toad") continue;
    const cd = (st.guard.get(u) ?? 1) - dt;
    st.guard.set(u, cd);
    if (cd > 0) continue;
    const e = rt.enemies.find(f => live(f) && (f.state === "chase" || f.state === "windup") && f.status.hold <= 0 && dist(f, me) <= BEAST.guard.reach && dist(f, u) > 1.6);
    if (!e) continue;
    st.guard.set(u, BEAST.guard.every);
    st.tongues.push({ from: { x: u.x, z: u.z }, to: { x: e.x, z: e.z }, t: 0 });
    const d = dist(e, u) || 1;
    pullEnemy(rt, e, { x: u.x + ((e.x - u.x) / d) * 1.2, z: u.z + ((e.z - u.z) / d) * 1.2 }, BEAST.guard.hold, BEAST.guard.power * v.mods.summonPower * rankScale(rt, u.source, "power"), ctxOf(rt, u), random);
  }
  for (let i = st.tongues.length - 1; i >= 0; i--) if ((st.tongues[i].t += dt) > 0.25) st.tongues.splice(i, 1);
  // The garden: when it closes, the beasts it raised go back unless you called them since.
  const g = st.garden;
  if (g && (g.t += dt) >= g.life) {
    rt.units = rt.units.filter(u => !g.added.has(u) || v.toggled[v.keys.findIndex(a => a?.key === u.source)]);
    st.garden = null;
  }
  stepRitual(rt, st, me, dt);
}

/**
 * The ritual: stepping into the circle with a beast still to tame calls its untamed form (after a short wait) to beat
 * alone. Leaving the ward, falling or running out of time ends it; its fall tames the beast.
 */
function stepRitual(rt: CombatRuntime, st: BeastState, me: Vec, dt: number) {
  const v = rt.v2!, p = rt.player, tamed = TAMED.get(rt);
  if (st.card && (st.cardLeft -= dt) <= 0) { if (rt.banner === st.card) rt.banner = null; st.card = null; }
  if (!tamed) return; // the harness and tests: no ritual
  const say = (kind: "foe" | "trait", title: string, text: string, seconds: number) => { st.card = rt.banner = { kind, title, text, until: Infinity }; st.cardLeft = seconds; };
  const next = nextToTame([...tamed]), inCircle = dist(me, RITUAL) <= RITUAL.r;
  const r = st.ritual;
  if (!r) {
    if (!inCircle) st.ritualArmed = true;
    if (!next || !inCircle || !st.ritualArmed || !p.alive || p.safe) return;
    st.ritual = { beast: next, enemy: null, t: 0 };
    st.ritualArmed = false;
    rt.units = rt.units.filter(u => !isBeast(u)); // alone: your beasts go back to the shadows
    v.toggled = v.toggled.map(() => false);
    say("foe", `The untamed ${next === "rabbits" ? "hare" : next}`, "Ritual of shadows · beat it alone, inside the ward", RITUAL.wait + 1.6);
    fx(rt, "summoner.ritual", "zone", RITUAL, me, "heavy", RITUAL.r);
    return;
  }
  r.t += dt;
  // Others stay out of it: anything else near the ward wanders off.
  for (const e of rt.enemies) if (e !== r.enemy && live(e) && dist(e, RITUAL) < RITUAL.ward + 4) e.status.distract = Math.max(e.status.distract, 0.5);
  const type = BEASTS.find(b => b.beast === r.beast)?.ritual;
  if (!r.enemy && r.t >= RITUAL.wait && type && ENEMIES[type]) {
    // Beyond the circle from you, turned along it until the spot is canyon floor (never up on a cliff).
    let a = Math.atan2(RITUAL.x - me.x, RITUAL.z - me.z) || 0;
    for (let k = 1; k < 12 && !zoneAt(RITUAL.x + Math.sin(a) * 3, RITUAL.z + Math.cos(a) * 3); k++) a += (k % 2 ? 1 : -1) * k * 0.5;
    const e = spawnEnemy(`ritual-${r.beast}-${rt.seq++}`, ENEMIES[type], RITUAL.x + Math.sin(a) * 3, RITUAL.z + Math.cos(a) * 3);
    e.summoned = true;
    rt.enemies.push(engage(e));
    r.enemy = e;
    fx(rt, "summoner.ritual", "impact", e, me, "heavy", 1.5);
  }
  const done = () => { st.ritual = null; equipClassKit(rt, v.kit, v.mastery, v.progress); }; // the beast keys open again
  const out = dist(me, RITUAL) > RITUAL.ward;
  if (!p.alive || out || r.t > RITUAL.limit) {
    if (r.enemy) rt.enemies = rt.enemies.filter(e => e !== r.enemy);
    done();
    say("foe", "The shadow sinks back", out ? "You left the ward. Step into the circle to try again." : "Step into the circle to try again.", 3.5);
    return;
  }
  if (r.enemy && r.enemy.state === "dead") {
    const id = r.enemy.type.id;
    rt.killQueue = rt.killQueue.filter(k => k.enemy !== id); // a ritual form is no kill on the server
    tamed.add(r.beast);
    st.events.push({ beast: r.beast, key: `tame:${r.beast}:${Date.now().toString(36)}:${rt.seq++}` });
    const slot = v.kit.keys.findIndex(a => a.tame === r.beast);
    done();
    say("trait", `The ${r.beast === "rabbits" ? "rabbits are" : `${r.beast} is`} tamed`, slot >= 0 ? `Key ${slot + 1} calls ${r.beast === "rabbits" ? "them" : "it"}.` : "", 5);
    fx(rt, "summoner.tamed", "impact", RITUAL, me, "heavy", RITUAL.r);
    return;
  }
  if (r.enemy) r.enemy.status.distract = 0; // the ritual form never wanders off
}
