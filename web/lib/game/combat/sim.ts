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
 * dashExit over dashTime) with i-frames through it; `duration` is the dodge's clock (no attacks), and a press waits
 * duration + cooldown = 0.6 s for the next. Air dashes give no i-frames (actions.ts dashDodge).
 */
export const DODGE = { duration: 0.22, iframeStart: 0.02, iframeEnd: 0.2, cooldown: 0.38 } as const;

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

// ── The guardian statue ─────────────────────────────────────────
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
export const bossPhase = (hpFraction: number): 1 | 2 | 3 => (hpFraction <= BOSS.enrage ? 3 : hpFraction <= BOSS.half ? 2 : 1);

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
}
export function spawnEnemy(id: string, type: EnemyType, x: number, z: number): Enemy {
  return { id, type, x, z, spawnX: x, spawnZ: z, hp: type.hp, state: "idle", t: 0, facing: Math.PI, stun: 0, wander: { x, z, wait: 1 }, aim: { x, z }, flash: 0, kx: 0, kz: 0, deadFor: 0,
    move: type.attacks[0], phase: 1, cycle: 0, beam: Math.PI, landed: false, summoned: false,
    status: { hold: 0, slow: 0, slowFor: 0, mark: 0, markFor: 0, distract: 0 }, raised: false };
}

/** The next attack: ordinary enemies have one; the boss follows its plan, enraged in phase 3. */
export function nextMove(e: Enemy): EnemyAttack {
  const moves = e.type.attacks;
  if (moves.length === 1) return moves[0];
  const plan = BOSS_PLAN[e.phase];
  const m = moves.find(x => x.shape === plan[e.cycle % plan.length]) ?? moves[0];
  e.cycle++;
  return e.phase === 3 ? { ...m, windup: m.windup * BOSS.enrageSpeed, recover: m.stagger ? m.recover : m.recover * BOSS.enrageSpeed, damage: Math.round(m.damage * BOSS.enrageDamage) } : m;
}
export const staggered = (e: Pick<Enemy, "state" | "move">) => e.state === "recover" && !!e.move.stagger;

/** Idle enemies stroll (combat polish 5): to a spot within `radius` of the spawn at `speed` × their pace, then wait 1.5–4 s. */
export const WANDER = { radius: 1.6, speed: 0.3, pause: 1.5, pauseMore: 2.5 } as const;
/** Packs keep apart: bodies closer than their radii plus `gap` push off each other at up to `speed` u/s. */
export const SEPARATION = { gap: 0.3, speed: 4 } as const;

export type EnemyEvent =
  | { kind: "strike"; enemy: Enemy }           // melee shapes resolved now
  | { kind: "spit"; enemy: Enemy; to: Vec }    // ranged: caller spawns the projectile
  | { kind: "beam"; enemy: Enemy }             // every tick the beam sweeps: caller checks beamLands
  | { kind: "summon"; enemy: Enemy }           // caller calls up to BOSS.summons rune wisps
  | { kind: "phase"; enemy: Enemy }            // the boss crossed a phase threshold
  | { kind: "reset"; enemy: Enemy };

/**
 * One tick. `player.safe` = standing in a safe zone: nothing may hit them there,
 * so every enemy gives up, walks home and heals (row 8). Leaving the leash
 * radius does the same.
 */
export function stepEnemy(e: Enemy, player: Vec & { safe: boolean; alive: boolean }, dt: number, free: (x: number, z: number) => boolean = () => true, random: () => number = Math.random): EnemyEvent | null {
  e.flash = Math.max(0, e.flash - dt);
  e.stun = Math.max(0, e.stun - dt);
  if (e.state === "dead") { e.deadFor += dt; return null; }
  // Knockback slides first, blocked by walls.
  if (e.kx || e.kz) {
    const nx = e.x + e.kx * dt, nz = e.z + e.kz * dt;
    if (free(nx, nz)) { e.x = nx; e.z = nz; }
    const decay = Math.exp(-8 * dt); e.kx *= decay; e.kz *= decay;
    if (Math.hypot(e.kx, e.kz) < 0.05) { e.kx = 0; e.kz = 0; }
  }
  if (e.type.kind === "boss" && e.state !== "return") {
    const phase = bossPhase(e.hp / e.type.hp);
    if (phase > e.phase) { e.phase = phase; e.cycle = 0; if (e.state === "chase") e.move = nextMove(e); return { kind: "phase", enemy: e }; }
  }
  // Statuses wear off; a held enemy does nothing (its windup waits too).
  const st = e.status;
  st.slowFor = Math.max(0, st.slowFor - dt); if (!st.slowFor) st.slow = 0;
  st.markFor = Math.max(0, st.markFor - dt); if (!st.markFor) st.mark = 0;
  st.distract = Math.max(0, st.distract - dt);
  if (st.hold > 0 && e.state !== "return") { st.hold = Math.max(0, st.hold - dt); return null; }
  const a = e.move;
  const home = Math.hypot(e.x - e.spawnX, e.z - e.spawnZ);
  const dist = Math.hypot(player.x - e.x, player.z - e.z);
  if (e.state !== "return" && e.state !== "idle" && (home > e.type.leashRadius || player.safe || !player.alive)) { e.state = "return"; e.t = 0; }
  const move = (tx: number, tz: number, speed: number) => {
    const d = Math.hypot(tx - e.x, tz - e.z);
    if (d < 1e-4) return d;
    const step = Math.min(d, speed * dt);
    const nx = e.x + ((tx - e.x) / d) * step, nz = e.z + ((tz - e.z) / d) * step;
    if (free(nx, nz)) { e.x = nx; e.z = nz; } else if (free(nx, e.z)) e.x = nx; else if (free(e.x, nz)) e.z = nz;
    e.facing = Math.atan2(tx - e.x, tz - e.z);
    return d - step;
  };
  switch (e.state) {
    case "idle": {
      if (player.alive && !player.safe && dist < e.type.aggroRadius) { e.state = "chase"; e.t = 0; e.move = nextMove(e); return null; }
      const w = e.wander;
      if (e.type.kind === "boss" || (w.wait -= dt) > 0) return null;
      if (move(w.x, w.z, e.type.speed * WANDER.speed) < 0.05) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random()) * WANDER.radius;
        w.x = e.spawnX + Math.sin(a) * r; w.z = e.spawnZ + Math.cos(a) * r; w.wait = WANDER.pause + random() * WANDER.pauseMore;
      }
      return null;
    }
    case "return":
      if (move(e.spawnX, e.spawnZ, e.type.speed * 1.5) < 0.05) {
        e.state = "idle"; e.hp = e.type.hp; e.facing = Math.PI; e.phase = 1; e.cycle = 0; e.move = e.type.attacks[0];
        e.wander.x = e.spawnX; e.wander.z = e.spawnZ; e.wander.wait = WANDER.pause;
        return { kind: "reset", enemy: e };
      }
      return null;
    case "chase": {
      if (e.stun > 0) return null;
      if (dist > (a.reach ?? a.range * 0.8)) { move(player.x, player.z, e.type.speed * (1 - st.slow)); return null; }
      e.state = "windup"; e.t = 0; e.facing = facingTo(e, player); e.aim = { x: player.x, z: player.z }; e.landed = false;
      return null;
    }
    case "windup":
      e.t += dt;
      if (e.t < a.windup) return null;
      e.t = 0;
      if (a.active) { e.state = "active"; e.beam = e.facing - a.arc / 2; return { kind: "beam", enemy: e }; }
      e.state = "recover";
      return a.shape === "spit" ? { kind: "spit", enemy: e, to: { ...e.aim } } : a.shape === "summon" ? { kind: "summon", enemy: e } : { kind: "strike", enemy: e };
    case "active":
      e.t += dt;
      e.beam = e.facing - a.arc / 2 + a.arc * Math.min(1, e.t / a.active!);
      if (e.t >= a.active!) { e.state = "recover"; e.t = 0; return null; }
      return { kind: "beam", enemy: e };
    case "recover":
      e.t += dt;
      if (e.t >= a.recover) { e.state = "chase"; e.t = 0; e.move = nextMove(e); }
      return null;
  }
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
      let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const min = a.type.radius + b.type.radius + SEPARATION.gap;
      if (d >= min) continue;
      if (d < 1e-4) { dx = Math.sin(i + j); dz = Math.cos(i + j); d = 1; } // exactly stacked: any way apart
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
  if (a.shape === "summon") return false;
  if (a.shape === "smash") return inArc(e.aim, 0, a.range, Math.PI * 2, player, playerRadius);
  return inArc(e, e.facing, a.range, a.shape === "slam" ? Math.PI * 2 : a.arc, player, playerRadius);
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
  const d = Math.hypot(e.x - from.x, e.z - from.z) || 1;
  const k = e.type.kind === "boss" ? knock * 0.1 : e.type.kind === "construct" ? knock * 0.5 : knock;
  e.kx = ((e.x - from.x) / d) * k; e.kz = ((e.z - from.z) / d) * k;
  e.stun = e.type.kind === "boss" ? 0 : e.type.elite ? STUN * 0.5 : STUN;
  if (e.state === "idle") { e.state = "chase"; e.t = 0; e.move = nextMove(e); }
  if (e.hp === 0) { e.state = "dead"; e.deadFor = 0; return true; }
  return false;
}
