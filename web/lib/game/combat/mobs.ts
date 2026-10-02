/**
 * Zone-1 mob mechanics the encounter tick runs (design sheet "Mobs, zone 1"; sim.ts moves and times them): a den or
 * cloud waking together, pounces, darts and charges touching you, a pollen sprite bursting, lobbed spores landing and
 * their poison puddles, the elder crab's shockwaves, a shell turning a hit aside, and the effects the scene paints
 * (`rt.fx`, drained by components/game/combat/MobFx.tsx). Pure over the runtime, no three.js.
 */
import { floater, hurtUnits, mitigate } from "./abilities";
import { hurtPlayer } from "./actions";
import { ENEMIES } from "./data";
import type { HazardDef } from "./contract";
import type { CombatRuntime, MobFxKind, Projectile } from "./runtime";
import { contactLands, engage, facingTo, invulnerable, PLANS, staggered, type Enemy, type EnemyEvent, type Vec } from "./sim";

/** Effects waiting to be painted, at most (the balance harness never drains them). */
const FX_MAX = 48;
export function mobFx(rt: CombatRuntime, kind: MobFxKind, x: number, z: number, rot = 0, size = 1) {
  rt.fx.push({ kind, x, z, rot, size });
  if (rt.fx.length > FX_MAX) rt.fx.shift();
}

const ENGAGED = new Set<Enemy["state"]>(["chase", "windup", "active", "recover"]);
const AWAKE = new Set<string>(), BUSY = new Map<string, number>();
/** Turns: while this many of a pack wind up or leap (one fox, two sprites), the rest wait until `gap` s after. */
export const PACK_TURN = { flank: { busy: 1, gap: 0.55 }, swarm: { busy: 2, gap: 0.3 } } as const;
/**
 * A pack fights together: once one of a den or a cloud is in the fight (it saw you, or you hit it), the rest join; and
 * it takes turns, so a den's pounces come one after another and a cloud's darts trickle in.
 */
export function rally(list: Enemy[]) {
  AWAKE.clear(); BUSY.clear();
  for (const e of list) {
    if (!e.pack) continue;
    if (ENGAGED.has(e.state)) AWAKE.add(e.pack.id);
    if (e.state === "windup" || e.state === "active") BUSY.set(e.pack.id, (BUSY.get(e.pack.id) ?? 0) + 1);
  }
  if (!AWAKE.size) return;
  for (const e of list) {
    if (!e.pack || !e.type.pack) continue;
    if (e.state === "idle" && AWAKE.has(e.pack.id)) engage(e);
    const turn = PACK_TURN[e.type.pack];
    if (e.state === "chase" && (BUSY.get(e.pack.id) ?? 0) >= turn.busy) e.cd = Math.max(e.cd, turn.gap);
  }
}

/**
 * The zone-1 events of one enemy's tick (sim.ts EnemyEvent). True when handled here; a strike comes back false after
 * its effects, so the encounter still resolves its hit as for every enemy.
 */
export function mobEvent(rt: CombatRuntime, ev: EnemyEvent, me: Vec, random: () => number): boolean {
  const e = ev.enemy, m = e.move;
  switch (ev.kind) {
    case "contact":
      if (contactLands(e, me)) {
        hurtPlayer(rt, m.damage, e, me, m.knockback, random);
        if (m.shape === "dart") burst(rt, e);
        else mobFx(rt, "pounce", me.x, me.z, e.facing, m.shape === "charge" ? 1.6 : 1);
      }
      return true;
    case "burst": burst(rt, e); return true;
    case "lob": {
      const flight = m.active ?? 0.8;
      rt.projectiles.push({ id: rt.seq++, x: e.x, z: e.z, vx: (ev.to.x - e.x) / flight, vz: (ev.to.z - e.z) / flight, life: flight, arc: flight,
        from: "enemy", damage: m.damage, kind: "spore", radius: m.splash ?? 1, knock: m.knockback, source: e.type.id });
      return true;
    }
    case "blink": mobFx(rt, "blink", ev.from.x, ev.from.z); mobFx(rt, "blink", e.x, e.z, 0, 0.8); return true;
    case "phase": {
      const note = PLANS[e.type.id]?.notes[e.phase - 2];
      if (note) floater(rt, e, 3.4, note, "info");
      if (e.type.kind !== "boss") mobFx(rt, e.phase === 2 ? "crack" : "slam", e.x, e.z, e.facing, e.type.radius * 2);
      return true;
    }
    case "strike":
      if (e.type.kind !== "wildlife") return false; // the temple and the guardian keep their own looks
      if (m.shape === "sweep") mobFx(rt, "slash", e.x + Math.sin(e.facing) * m.range * 0.55, e.z + Math.cos(e.facing) * m.range * 0.55, e.facing, m.range);
      else if (m.shape === "slam") {
        mobFx(rt, "slam", e.x, e.z, 0, m.range);
        const h = e.type.hazard;
        if (h?.kind === "wave" && m.splash) addHazard(rt, { ...h, radius: m.splash }, e.x, e.z, Math.round(m.damage * WAVE.damage), m.range, WAVE.knock);
      }
      return false;
    default: return false;
  }
}

/** A swarm sprite pops in a cloud of its pollen (its hazard): gone, and no kill credit for you. */
function burst(rt: CombatRuntime, e: Enemy) {
  e.state = "dead"; e.deadFor = 0; e.hp = 0;
  const h = e.type.hazard;
  if (h) addHazard(rt, h, e.x, e.z, h.damage);
  mobFx(rt, "pollen", e.x, e.z, 0, h?.radius ?? 1);
}

/** A lobbed spore ball lands: it bursts on its ring (on you, on your summons) and leaves its thrower's puddle. */
export function landLob(rt: CombatRuntime, sh: Projectile, me: Vec, random: () => number) {
  if (Math.hypot(me.x - sh.x, me.z - sh.z) <= sh.radius + 0.35) hurtPlayer(rt, sh.damage, sh, me, sh.knock ?? 1, random);
  hurtUnits(rt, u => Math.hypot(u.x - sh.x, u.z - sh.z) <= sh.radius + 0.4, sh.damage);
  const h = sh.source ? ENEMIES[sh.source]?.hazard : undefined;
  if (h) addHazard(rt, h, sh.x, sh.z, h.damage);
  mobFx(rt, "spores", sh.x, sh.z, 0, sh.radius);
}
/** A lob's height over its flight (`t` seconds left of `arc`): a hop that peaks at 1.6 u for a full second's flight. */
export const lobHeight = (life: number, arc: number) => { const k = 1 - life / arc; return 4 * k * (1 - k) * 1.6 * Math.min(1, arc); };

/** The elder's shockwave: its front is this wide, it deals this share of the slam, and pushes this hard. */
export const WAVE = { band: 0.45, damage: 0.6, knock: 3 } as const;
/** How long a slow lingers after you step out of the pollen. */
const SLOW_FOR = 0.6;
function addHazard(rt: CombatRuntime, h: HazardDef, x: number, z: number, damage: number, r0 = 0, knock = 0) {
  rt.hazards.push({ id: rt.seq++, kind: h.kind, x, z, r: h.radius, r0, age: 0, life: h.life, damage, every: h.every, tick: 0, slow: h.slow ?? 0, knock, hit: false });
  if (rt.hazards.length > 24) rt.hazards.shift();
}

/** Puddles tick while you stand in them, pollen slows you, a shockwave hits once as its front passes you. */
export function stepHazards(rt: CombatRuntime, me: Vec, dt: number, random: () => number) {
  for (let i = rt.hazards.length - 1; i >= 0; i--) {
    const h = rt.hazards[i];
    h.age += dt;
    if (h.age >= h.life) { rt.hazards.splice(i, 1); continue; }
    const d = Math.hypot(me.x - h.x, me.z - h.z);
    if (h.kind === "wave") {
      const r = h.r0 + (h.r - h.r0) * (h.age / h.life);
      if (!h.hit && Math.abs(d - r) < WAVE.band) { h.hit = true; hurtPlayer(rt, h.damage, h, me, h.knock, random); }
      continue;
    }
    if (d > h.r + 0.3) continue;
    if (h.slow) slowPlayer(rt, h.slow);
    if (h.damage && (h.tick -= dt) <= 0) { h.tick = h.every; seep(rt, h.damage, h, me); }
  }
}
function slowPlayer(rt: CombatRuntime, slow: number) {
  const b = rt.buffs.find(x => x.stat === "speed" && x.value < 0);
  if (b) { b.value = -Math.max(-b.value, slow); b.t = Math.max(b.t, SLOW_FOR); } else rt.buffs.push({ stat: "speed", value: -slow, t: SLOW_FOR });
}
/** A poison tick: guard and shields soak it, i-frames and the safe zone skip it; no flinch, hitstop or shake (it's a seep). */
function seep(rt: CombatRuntime, amount: number, from: Vec, me: Vec) {
  const p = rt.player;
  if (!p.alive || p.safe || invulnerable(p.dodgeAge) || p.dash?.iframes) return;
  const { damage } = mitigate(rt, amount, from, me);
  if (damage <= 0) return;
  p.hp = Math.max(0, p.hp - damage);
  floater(rt, me, 1.7, `-${damage}`, "hurt");
  if (p.hp === 0) { p.alive = false; p.downFor = 0; rt.casting = null; }
}

/** The status word for a hit on a shell (one at a time). */
export const SHELL_NOTE = "Shell · strike its back";
/** A hit the shell turned aside: sparks where it glanced, and the hint. */
export function shellNote(rt: CombatRuntime, e: Enemy, from: Vec) {
  const a = facingTo(e, from);
  mobFx(rt, "glance", e.x + Math.sin(a) * e.type.radius, e.z + Math.cos(a) * e.type.radius, a);
  if (!rt.floaters.some(f => f.text === SHELL_NOTE)) floater(rt, e, 2 + e.type.hover, SHELL_NOTE, "info");
}

/** The fight that gets the bar at the top: a mini-boss in the fight (the elder crab), or the guardian once engaged. */
export function bigFoe(rt: Pick<CombatRuntime, "enemies" | "bossEngaged">): Enemy | undefined {
  return rt.enemies.find(e => e.type.miniboss && ENGAGED.has(e.state)) ?? (rt.bossEngaged ? rt.enemies.find(e => e.type.kind === "boss") : undefined);
}
/** The health fractions where its phases turn, for ticks on a mini-boss's bar. */
export const phaseMarks = (e: Enemy): readonly number[] => (e.type.miniboss ? PLANS[e.type.id]?.at ?? [] : []);
/** The line under the bar: what to do now. */
export function foeHint(e: Enemy): string {
  if (e.type.kind === "boss") return staggered(e) ? "Staggered: strike now" : e.phase === 3 ? "Enraged" : e.phase === 2 ? "Calling rune wisps" : "Watch the ring and the beam";
  if (staggered(e)) return "Stunned after its charge: strike now";
  return e.phase === 3 ? "Enraged: dodge through the shockwaves" : e.phase === 2 ? "Shell cracked: watch the lane, it charges" : "Shell closed: strike its back";
}
