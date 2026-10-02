/**
 * Encounter rules the island runs every frame (pure, no three.js): hit shapes,
 * dodge i-frames, enemy aggro / telegraph / attack / leash, the safe-zone
 * reset, and the guardian statue's pattern rotation. Numbers are placeholders
 * until web/lib/combat supplies the rules.
 */
import type { AttackShape, EnemyAttack, EnemyType } from "./contract";

export interface Vec { x: number; z: number }

/**
 * The dodge (row 50, combat polish 9) is the village dash (the movement kit's burst: MOVE_TUNING dashSpeed, dashEase,
 * dashExit over its 0.2 s) with i-frames through it and a little past; `duration` is the dodge's clock (no attacks), and
 * a press waits duration + cooldown = 0.6 s for the next. Air dashes give no i-frames (actions.ts dashDodge).
 */
export const DODGE = { duration: 0.34, iframeStart: 0.02, iframeEnd: 0.3, cooldown: 0.26 } as const;

export const facingTo = (from: Vec, to: Vec) => Math.atan2(to.x - from.x, to.z - from.z);
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Melee / sweep: target circle overlaps a sector of `range` and total angle `arc` around `facing`. */
export function inArc(origin: Vec, facing: number, range: number, arc: number, target: Vec, targetRadius = 0): boolean {
  const d = Math.hypot(target.x - origin.x, target.z - origin.z);
  if (d > range + targetRadius) return false;
  if (arc >= Math.PI * 2 - 1e-6 || d < 1e-6) return true;
  // Allow the target's radius to poke into the sector edge.
  const slack = d > targetRadius ? Math.asin(Math.min(1, targetRadius / d)) : Math.PI;
  return angleDiff(facingTo(origin, target), facing) <= arc / 2 + slack;
}

/** Distance from `p` to the segment a→b. */
export function segDist(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}
/** Projectile travelling from→to this frame: did it pass within `radius` of `center`? */
export const sweptHit = (from: Vec, to: Vec, center: Vec, radius: number) => segDist(center, from, to) <= radius;

/** Seconds since the dodge began → invulnerable? */
export function invulnerable(dodgeAge: number | null): boolean {
  return dodgeAge !== null && dodgeAge >= DODGE.iframeStart && dodgeAge <= DODGE.iframeEnd;
}

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export const inRect = (p: Vec, r: Rect) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

// ── Phased fights: the guardian statue and the elder thorn crab ─────────
/**
 * Three readable patterns in a fixed rotation per phase: above half health
 * slam, slam, beam; below half it opens with two rune wisps and repeats the
 * summon every sixth move; at a fifth it enrages (faster windups, harder hits).
 * Every beam ends in a stagger window where hits land for half again as much.
 */
export const BOSS = { half: 0.5, enrage: 0.2, enrageSpeed: 0.7, enrageDamage: 1.25, staggerBonus: 1.5, summons: 2 } as const;
export const BOSS_PLAN: Record<1 | 2 | 3, AttackShape[]> = {
  1: ["smash", "smash", "beam"],
  2: ["summon", "smash", "beam", "smash", "smash", "beam"],
  3: ["summon", "smash", "beam", "smash", "smash", "beam"],
};
/**
 * A fight in phases: health fractions where phases 2 and 3 begin, the rotation per phase, windup (and recover) speed and
 * damage per phase, and the line each new phase announces.
 */
export interface PhasePlan { at: [number, number]; plan: Record<1 | 2 | 3, AttackShape[]>; speed: [number, number, number]; damage: [number, number, number]; notes: [string, string] }
/**
 * The elder thorn crab (mini-boss, design sheet "Mobs, zone 1"): shell closed above 60% (armoured, slow claw sweeps), the
 * shell cracks at 60% (faster sweeps and a charge down a lane), enraged at 25% (claw slams with shockwaves).
 */
export const ELDER = { cracked: 0.6, enraged: 0.25 } as const;
export const PLANS: Record<string, PhasePlan> = {
  "guardian-statue": { at: [BOSS.half, BOSS.enrage], plan: BOSS_PLAN, speed: [1, 1, BOSS.enrageSpeed], damage: [1, 1, BOSS.enrageDamage], notes: ["The guardian calls for help", "Enraged"] },
  "elder-thorn-crab": { at: [ELDER.cracked, ELDER.enraged], plan: { 1: ["sweep"], 2: ["sweep", "sweep", "charge"], 3: ["slam", "sweep", "charge", "slam", "sweep"] },
    speed: [1, 0.72, 0.62], damage: [1, 1.1, 1.25], notes: ["Its shell cracks", "Enraged: claw slams"] },
};
export const phaseOf = (plan: PhasePlan, hpFraction: number): 1 | 2 | 3 => (hpFraction <= plan.at[1] ? 3 : hpFraction <= plan.at[0] ? 2 : 1);
export const bossPhase = (hpFraction: number) => phaseOf(PLANS["guardian-statue"], hpFraction);

export type EnemyState = "idle" | "chase" | "windup" | "active" | "recover" | "return" | "dead";
export interface Enemy {
  id: string; type: EnemyType; x: number; z: number; spawnX: number; spawnZ: number;
  hp: number; state: EnemyState; t: number; facing: number;
  /** Seconds a hit holds its chase (the stagger push); a windup already under way carries on. */
  stun: number;
  /** Idle: the spot it strolls to near its spawn, and how long it waits there first. */
  wander: { x: number; z: number; wait: number };
  /** Where the attack was aimed when the windup began (the telegraph). */
  aim: Vec; flash: number; kx: number; kz: number; deadFor: number;
  /** The attack being telegraphed or thrown (the boss rotates through several). */
  move: EnemyAttack;
  /** Boss phase (1 above half, 2 below, 3 enraged) and the index into its rotation. */
  phase: 1 | 2 | 3; cycle: number;
  /** Beam direction while active; whether the current move already landed on the player. */
  beam: number; landed: boolean;
  /** Called by the boss: cleared when it resets. */
  summoned: boolean;
  /** Kit statuses (lib/combat/kits.ts Status): held in place, slowed, marked for more damage, distracted (wanders home). */
  status: { hold: number; slow: number; slowFor: number; mark: number; markFor: number; distract: number };
  /** A Necromancer already raised this body. */
  raised: boolean;
  /** Its den or cloud (spawns.ts): the pack's id and centre, its slot in it and the pack's size. */
  pack: Pack | null;
  /** Seconds until its special move is ready: a pack member's next pounce or dart, a wisp's next blink. */
  cd: number;
  /** A swarm's turn round you (radians), shared by the cloud because they all turn at one rate. */
  orbit: number;
}
export interface Pack { id: string; slot: number; size: number; cx: number; cz: number }
export function spawnEnemy(id: string, type: EnemyType, x: number, z: number, pack: Pack | null = null): Enemy {
  return { id, type, x, z, spawnX: x, spawnZ: z, hp: type.hp, state: "idle", t: 0, facing: Math.PI, stun: 0, wander: { x, z, wait: 1 }, aim: { x, z }, flash: 0, kx: 0, kz: 0, deadFor: 0,
    move: type.attacks[0], phase: 1, cycle: 0, beam: Math.PI, landed: false, summoned: false,
    status: { hold: 0, slow: 0, slowFor: 0, mark: 0, markFor: 0, distract: 0 }, raised: false, pack, cd: 0, orbit: 0 };
}

/** The next attack: ordinary enemies have one (a wisp's blink comes apart); a phased fight follows its plan, faster and harder as it goes. */
export function nextMove(e: Enemy): EnemyAttack {
  const moves = e.type.attacks, plan = PLANS[e.type.id];
  if (!plan) return moves[0];
  const shapes = plan.plan[e.phase];
  const m = moves.find(x => x.shape === shapes[e.cycle % shapes.length]) ?? moves[0];
  e.cycle++;
  const speed = plan.speed[e.phase - 1], damage = plan.damage[e.phase - 1];
  return speed === 1 && damage === 1 ? m : { ...m, windup: m.windup * speed, recover: m.stagger ? m.recover : m.recover * speed, damage: Math.round(m.damage * damage) };
}

/**
 * How long a pack member waits after it joins the fight before its first pounce or dart: a fox pack goes in turn, a
 * swarm's darts trickle in over a few seconds (the golden-ratio spread keeps neighbours apart). Others: nothing to wait for.
 */
export const PACK_TIMING = { flank: 0.45, swarmFirst: 0.6, swarmSpread: 5, flankAgain: 0.5 } as const;
const packDelay = (e: Enemy) => !e.pack ? 0 : e.type.pack === "flank" ? e.pack.slot * PACK_TIMING.flank
  : PACK_TIMING.swarmFirst + ((e.pack.slot * 0.618034) % 1) * PACK_TIMING.swarmSpread;
/** Into the fight: chase with its first move; a pack member takes its turn's wait. Returns it. */
export function engage(e: Enemy): Enemy {
  e.state = "chase"; e.t = 0; e.move = nextMove(e); e.cd = Math.max(e.cd, packDelay(e));
  return e;
}
export const staggered = (e: Pick<Enemy, "state" | "move">) => e.state === "recover" && !!e.move.stagger;

/** Idle enemies stroll (combat polish 5): to a spot within `radius` of the spawn at `speed` × their pace, then wait 1.5–4 s. */
export const WANDER = { radius: 1.6, speed: 0.3, pause: 1.5, pauseMore: 2.5 } as const;
/** Step toward (tx, tz), sliding along walls; returns the distance left. (Module scope: the tick allocates nothing per enemy.) */
function walk(e: Enemy, tx: number, tz: number, speed: number, dt: number, free: (x: number, z: number) => boolean, face = true): number {
  const d = Math.sqrt((tx - e.x) ** 2 + (tz - e.z) ** 2);
  if (d < 1e-4) return d;
  const step = Math.min(d, speed * dt);
  const nx = e.x + ((tx - e.x) / d) * step, nz = e.z + ((tz - e.z) / d) * step;
  if (free(nx, nz)) { e.x = nx; e.z = nz; } else if (free(nx, e.z)) e.x = nx; else if (free(e.x, nz)) e.z = nz;
  if (face) e.facing = Math.atan2(tx - e.x, tz - e.z);
  return d - step;
}
/** Turn toward `to` by at most `rate` × dt (a crab's slow turn). */
function turnToward(e: Enemy, to: number, rate: number, dt: number) {
  const d = Math.atan2(Math.sin(to - e.facing), Math.cos(to - e.facing)), step = rate * dt;
  e.facing += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

/**
 * Where a pack member heads in the chase (one scratch result: read it before the next call). Flank: a slot round you,
 * the first between you and the den, the others to your sides and back. Swarm: a ring round you that the cloud turns
 * along. Past you it goes round, not through you.
 */
const FLANK = [0, 2.1, -2.1, 1.05, -1.05] as const, SWARM = { radius: 2.3, spread: 0.45, turn: 1.1 } as const;
const GOAL = { x: 0, z: 0 };
export function packGoal(e: Enemy, player: Vec, standoff: number): Vec {
  const p = e.pack!, bearing = Math.atan2(p.cx - player.x, p.cz - player.z);
  const swarm = e.type.pack === "swarm", now = Math.atan2(e.x - player.x, e.z - player.z);
  // A fox takes its slot on whichever side it is (after a pounce it lands across you): mirrored, never back through the den.
  const slot = FLANK[p.slot % FLANK.length], mirror = p.slot === 0 ? Math.PI : -slot;
  const want = bearing + (swarm ? (p.slot / p.size) * Math.PI * 2 + e.orbit : angleDiff(now, bearing + slot) <= angleDiff(now, bearing + mirror) ? slot : mirror);
  const r = swarm ? SWARM.radius + (p.slot % 3) * SWARM.spread : standoff;
  const gap = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  // Far round the circle: step along it (a quarter-radian at a time) at your distance or the standoff, whichever is wider.
  const a = Math.abs(gap) > 0.6 ? now + Math.sign(gap) * 0.6 : want, rr = Math.abs(gap) > 0.6 ? Math.max(r, Math.min(Math.hypot(e.x - player.x, e.z - player.z), r * 1.6)) : r;
  GOAL.x = player.x + Math.sin(a) * rr; GOAL.z = player.z + Math.cos(a) * rr;
  return GOAL;
}

/** A shell's share of a hit from `from`: `front` (or `cracked` from phase 2) inside its front arc, else all of it. */
export function shellFactor(e: Pick<Enemy, "x" | "z" | "facing" | "phase" | "type">, from: Vec): number {
  const s = e.type.shell;
  if (!s || Math.hypot(from.x - e.x, from.z - e.z) < 1e-3 || angleDiff(facingTo(e, from), e.facing) > s.arc / 2) return 1;
  return e.phase > 1 && s.cracked !== undefined ? s.cracked : s.front;
}
/** Where a travelling attack (pounce, dart, charge) ends if nothing stops it: `leap` along its facing. */
export function leapEnd(e: Pick<Enemy, "x" | "z" | "facing" | "move">, out: Vec = { x: 0, z: 0 }): Vec {
  const l = e.move.leap ?? 0;
  out.x = e.x + Math.sin(e.facing) * l; out.z = e.z + Math.cos(e.facing) * l;
  return out;
}
const TRAVEL = new Set<AttackShape>(["pounce", "dart", "charge"]);
export const travels = (shape: AttackShape) => TRAVEL.has(shape);

/** Packs keep apart: bodies closer than their radii plus `gap` push off each other at up to `speed` u/s. */
export const SEPARATION = { gap: 0.3, speed: 4 } as const;

export type EnemyEvent =
  | { kind: "strike"; enemy: Enemy }           // melee shapes resolved now
  | { kind: "spit"; enemy: Enemy; to: Vec }    // ranged: caller spawns the projectile
  | { kind: "lob"; enemy: Enemy; to: Vec }     // arcing: caller spawns a shot that lands at `to` after `move.active` s
  | { kind: "beam"; enemy: Enemy }             // every tick the beam sweeps: caller checks beamLands
  | { kind: "contact"; enemy: Enemy }          // every tick a pounce, dart or charge travels: caller checks contactLands
  | { kind: "burst"; enemy: Enemy }            // a swarm sprite's dart ran out: it pops where it is (no kill credit)
  | { kind: "blink"; enemy: Enemy; from: Vec } // it hopped away to keep its range
  | { kind: "summon"; enemy: Enemy }           // caller calls up to BOSS.summons rune wisps
  | { kind: "phase"; enemy: Enemy }            // a phased fight crossed a threshold
  | { kind: "reset"; enemy: Enemy };

/**
 * One tick. `player.safe` = standing in a safe zone: nothing may hit them there,
 * so every enemy gives up, walks home and heals (row 8). Leaving the leash
 * radius does the same.
 */
export function stepEnemy(e: Enemy, player: Vec & { safe: boolean; alive: boolean }, dt: number, free: (x: number, z: number) => boolean = () => true, random: () => number = Math.random): EnemyEvent | null {
  e.flash = Math.max(0, e.flash - dt);
  e.stun = Math.max(0, e.stun - dt);
  e.cd = Math.max(0, e.cd - dt);
  if (e.state === "dead") { e.deadFor += dt; return null; }
  // Knockback slides first, blocked by walls.
  if (e.kx || e.kz) {
    const nx = e.x + e.kx * dt, nz = e.z + e.kz * dt;
    if (free(nx, nz)) { e.x = nx; e.z = nz; }
    const decay = Math.exp(-8 * dt); e.kx *= decay; e.kz *= decay;
    if (Math.hypot(e.kx, e.kz) < 0.05) { e.kx = 0; e.kz = 0; }
  }
  const plan = PLANS[e.type.id];
  if (plan && e.state !== "return") {
    const phase = phaseOf(plan, e.hp / e.type.hp);
    if (phase > e.phase) {
      e.phase = phase; e.cycle = 0;
      if (e.state === "chase") e.move = nextMove(e);
      if (e.type.kind !== "boss") e.stun = Math.max(e.stun, 0.8); // the elder reels as its shell cracks
      return { kind: "phase", enemy: e };
    }
  }
  // Statuses wear off; a held enemy does nothing (its windup waits too).
  const st = e.status;
  st.slowFor = Math.max(0, st.slowFor - dt); if (!st.slowFor) st.slow = 0;
  st.markFor = Math.max(0, st.markFor - dt); if (!st.markFor) st.mark = 0;
  st.distract = Math.max(0, st.distract - dt);
  if (st.hold > 0 && e.state !== "return") { st.hold = Math.max(0, st.hold - dt); return null; }
  const a = e.move, type = e.type;
  const home = Math.sqrt((e.x - e.spawnX) ** 2 + (e.z - e.spawnZ) ** 2);
  const dist = Math.sqrt((player.x - e.x) ** 2 + (player.z - e.z) ** 2);
  if (e.state !== "return" && e.state !== "idle" && e.state !== "active" && (home > type.leashRadius || player.safe || !player.alive)) { e.state = "return"; e.t = 0; }
  switch (e.state) {
    case "idle": {
      if (player.alive && !player.safe && dist < type.aggroRadius) { engage(e); return null; }
      const w = e.wander;
      if (type.kind === "boss" || (w.wait -= dt) > 0) return null;
      if (walk(e, w.x, w.z, type.speed * WANDER.speed, dt, free) < 0.05) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random()) * WANDER.radius;
        w.x = e.spawnX + Math.sin(a) * r; w.z = e.spawnZ + Math.cos(a) * r; w.wait = WANDER.pause + random() * WANDER.pauseMore;
      }
      return null;
    }
    case "return":
      if (walk(e, e.spawnX, e.spawnZ, type.speed * 1.5, dt, free) < 0.05) {
        e.state = "idle"; e.hp = type.hp; e.facing = Math.PI; e.phase = 1; e.cycle = 0; e.move = type.attacks[0]; e.cd = 0; e.orbit = 0;
        e.wander.x = e.spawnX; e.wander.z = e.spawnZ; e.wander.wait = WANDER.pause;
        return { kind: "reset", enemy: e };
      }
      return null;
    case "chase": {
      if (e.stun > 0) return null;
      const speed = type.speed * (1 - st.slow), reach = a.reach ?? a.range * 0.8;
      // A wisp too close for comfort blinks away (its tell: a short shimmer).
      const blink = type.kite && e.cd <= 0 && dist < type.kite.keep ? type.attacks.find(m => m.shape === "blink") : undefined;
      if (blink) { e.move = blink; e.state = "windup"; e.t = 0; return null; }
      // Packs: to a slot round you (flank) or round the ring (swarm), and only in turn.
      if (e.pack && type.pack) {
        e.t += dt;
        if (type.pack === "swarm") e.orbit += SWARM.turn * dt;
        const g = packGoal(e, player, reach * 0.9), there = Math.hypot(g.x - e.x, g.z - e.z) < 0.8;
        const ready = e.cd <= 0 && dist <= reach + 0.5 && (there || dist < 1.4 || e.t > 3);
        if (!ready) { walk(e, g.x, g.z, speed, dt, free); if (!there) return null; e.facing = facingTo(e, player); return null; }
      } else if (type.turn) {
        // A crab scuttles toward you (sideways if it must) while its body turns slowly; it swings only once you're in front.
        turnToward(e, facingTo(e, player), type.turn, dt);
        const front = angleDiff(facingTo(e, player), e.facing) < Math.max(0.35, a.arc / 2 * 0.8);
        if (dist > reach || !(front || a.arc >= Math.PI * 2 || travels(a.shape))) { if (dist > reach * 0.7) walk(e, player.x, player.z, speed, dt, free, false); return null; }
      } else if (dist > reach) { walk(e, player.x, player.z, speed, dt, free); return null; }
      e.state = "windup"; e.t = 0; e.aim = { x: player.x, z: player.z }; e.landed = false;
      // The windup commits the way it will go: at you, except a turning crab's sweep, which goes where it faces.
      if (!type.turn || travels(a.shape)) e.facing = facingTo(e, player);
      return null;
    }
    case "windup":
      e.t += dt;
      if (e.t < a.windup) return null;
      e.t = 0;
      if (a.shape === "blink") return hop(e, player, free);
      if (a.shape === "lob") { e.state = "recover"; return { kind: "lob", enemy: e, to: { ...e.aim } }; }
      if (a.active) { e.state = "active"; e.beam = e.facing - a.arc / 2; return a.shape === "beam" ? { kind: "beam", enemy: e } : { kind: "contact", enemy: e }; }
      e.state = "recover";
      return a.shape === "spit" ? { kind: "spit", enemy: e, to: { ...e.aim } } : a.shape === "summon" ? { kind: "summon", enemy: e } : { kind: "strike", enemy: e };
    case "active": {
      e.t += dt;
      if (a.shape === "beam") {
        e.beam = e.facing - a.arc / 2 + a.arc * Math.min(1, e.t / a.active!);
        if (e.t >= a.active!) { e.state = "recover"; e.t = 0; return null; }
        return { kind: "beam", enemy: e };
      }
      // Pounce, dart, charge: along its facing at leap / active u/s; a wall, or the edge of its leash, stops it short.
      const step = ((a.leap ?? 0) / a.active!) * dt, nx = e.x + Math.sin(e.facing) * step, nz = e.z + Math.cos(e.facing) * step;
      const blocked = !free(nx, nz) || Math.hypot(nx - e.spawnX, nz - e.spawnZ) > type.leashRadius * 0.95;
      if (!blocked) { e.x = nx; e.z = nz; }
      if (blocked || e.t >= a.active!) { e.state = "recover"; e.t = 0; return a.shape === "dart" ? { kind: "burst", enemy: e } : null; }
      return { kind: "contact", enemy: e };
    }
    case "recover":
      e.t += dt;
      if (e.t >= a.recover) {
        e.state = "chase"; e.t = 0; e.move = nextMove(e);
        if (type.pack === "flank" && e.pack) e.cd = Math.max(e.cd, PACK_TIMING.flankAgain + e.pack.slot * 0.2);
      }
      return null;
  }
}

/** The blink: `leap` u away from you, the first free spot fanning out from straight away; then a short recover. */
const HOP = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
function hop(e: Enemy, player: Vec, free: (x: number, z: number) => boolean): EnemyEvent {
  const from = { x: e.x, z: e.z }, away = Math.atan2(e.x - player.x, e.z - player.z), l = e.move.leap ?? 4;
  e.state = "recover"; e.cd = e.type.kite?.every ?? 4;
  for (const o of HOP) {
    const x = e.x + Math.sin(away + o) * l, z = e.z + Math.cos(away + o) * l;
    if (free(x, z) && Math.hypot(x - e.spawnX, z - e.spawnZ) < e.type.leashRadius * 0.9) { e.x = x; e.z = z; e.facing = facingTo(e, player); break; }
  }
  return { kind: "blink", enemy: e, from };
}

/** Packs keep apart: each overlapping pair of live enemies eases off along the line between them (the boss stands its ground). */
export function separate(list: Enemy[], dt: number, free: (x: number, z: number, r: number) => boolean = () => true) {
  const step = SEPARATION.speed * dt;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state === "dead") continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state === "dead") continue;
      const min = a.type.radius + b.type.radius + SEPARATION.gap, d2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
      if (d2 >= min * min) continue; // most pairs: no square root, nothing allocated
      const stacked = d2 < 1e-8, d = stacked ? 1 : Math.sqrt(d2);
      const dx = stacked ? Math.sin(i + j) : b.x - a.x, dz = stacked ? Math.cos(i + j) : b.z - a.z; // exactly stacked: any way apart
      const fixedA = a.type.kind === "boss", fixedB = b.type.kind === "boss";
      if (fixedA && fixedB) continue;
      const push = Math.min(min - d, step), ux = dx / d, uz = dz / d, ka = fixedA ? 0 : fixedB ? 1 : 0.5, kb = 1 - ka;
      if (ka && free(a.x - ux * push * ka, a.z - uz * push * ka, a.type.radius * 0.6)) { a.x -= ux * push * ka; a.z -= uz * push * ka; }
      if (kb && free(b.x + ux * push * kb, b.z + uz * push * kb, b.type.radius * 0.6)) { b.x += ux * push * kb; b.z += uz * push * kb; }
    }
  }
}

/** Does a strike land on the player? Arcs and slams from the enemy, smashes on the ring marker they aimed. */
export function strikeLands(e: Enemy, player: Vec, playerRadius = 0.35): boolean {
  const a = e.move;
  if (a.shape === "summon" || a.shape === "blink") return false;
  if (a.shape === "smash") return inArc(e.aim, 0, a.range, Math.PI * 2, player, playerRadius);
  if (a.shape === "lob") return Math.hypot(player.x - e.aim.x, player.z - e.aim.z) <= (a.splash ?? 1) + playerRadius;
  if (travels(a.shape)) return segDist(player, e, leapEnd(e, END)) <= e.type.radius + playerRadius;
  return inArc(e, e.facing, a.range, a.shape === "slam" ? Math.PI * 2 : a.arc, player, playerRadius);
}
const END = { x: 0, z: 0 };
/** A pounce, dart or charge touching you as it travels: once per attack. */
export function contactLands(e: Enemy, player: Vec, playerRadius = 0.35): boolean {
  if (e.state !== "active" || e.landed || Math.hypot(player.x - e.x, player.z - e.z) > e.type.radius + playerRadius + 0.15) return false;
  e.landed = true;
  return true;
}

/** The beam hits once per sweep, when it passes over the player within its length. */
export function beamLands(e: Enemy, player: Vec, playerRadius = 0.35): boolean {
  if (e.state !== "active" || e.landed) return false;
  const d = Math.hypot(player.x - e.x, player.z - e.z);
  if (d > e.move.range + playerRadius || d < 1e-6) return false;
  if (angleDiff(facingTo(e, player), e.beam) > 0.12 + Math.asin(Math.min(1, playerRadius / d))) return false;
  e.landed = true;
  return true;
}

/** A hit's stagger: the enemy's chase holds this long (elites half, the boss not at all), so the push reads. */
export const STUN = 0.15;
/** Apply damage + knockback and the stagger; returns true when this hit kills. Enemies walking home take no damage. */
export function damageEnemy(e: Enemy, amount: number, from: Vec, knock: number): boolean {
  if (e.state === "dead" || e.state === "return") return false;
  e.hp = Math.max(0, e.hp - amount);
  e.flash = 0.18;
  const d = Math.hypot(e.x - from.x, e.z - from.z) || 1, shell = shellFactor(e, from) < 1;
  // A hit on the shell barely budges it and never staggers it; a travelling attack carries on through a push.
  const k = (e.type.kind === "boss" || e.type.miniboss ? knock * 0.1 : e.type.kind === "construct" ? knock * 0.5 : knock) * (shell ? 0.3 : 1) * (e.state === "active" ? 0 : 1);
  e.kx = ((e.x - from.x) / d) * k; e.kz = ((e.z - from.z) / d) * k;
  e.stun = e.type.kind === "boss" || shell ? 0 : e.type.elite ? STUN * 0.5 : STUN;
  if (e.state === "idle") engage(e);
  if (e.hp === 0) { e.state = "dead"; e.deadFor = 0; return true; }
  return false;
}
