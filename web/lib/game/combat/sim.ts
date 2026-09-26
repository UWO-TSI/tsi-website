/**
 * Encounter rules the island runs every frame (pure, no three.js): hit shapes,
 * dodge i-frames, enemy aggro / telegraph / attack / leash, and the safe-zone
 * reset. Numbers are placeholders until web/lib/combat supplies the rules.
 */
import type { EnemyType } from "./contract";

export interface Vec { x: number; z: number }

/** Dodge roll: a short dash; invulnerable for most of it (row 50). */
export const DODGE = { duration: 0.34, speed: 14, iframeStart: 0.02, iframeEnd: 0.3, cooldown: 0.55 } as const;

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

/** Projectile travelling from→to this frame: did it pass within `radius` of `center`? */
export function sweptHit(from: Vec, to: Vec, center: Vec, radius: number): boolean {
  const dx = to.x - from.x, dz = to.z - from.z, len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.z - from.z) * dz) / len2));
  return Math.hypot(from.x + dx * t - center.x, from.z + dz * t - center.z) <= radius;
}

/** Seconds since the dodge began → invulnerable? */
export function invulnerable(dodgeAge: number | null): boolean {
  return dodgeAge !== null && dodgeAge >= DODGE.iframeStart && dodgeAge <= DODGE.iframeEnd;
}

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export const inRect = (p: Vec, r: Rect) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

export type EnemyState = "idle" | "chase" | "windup" | "recover" | "return" | "dead";
export interface Enemy {
  id: string; type: EnemyType; x: number; z: number; spawnX: number; spawnZ: number;
  hp: number; state: EnemyState; t: number; facing: number;
  /** Where the attack was aimed when the windup began (the telegraph). */
  aim: Vec; flash: number; kx: number; kz: number; deadFor: number;
}
export function spawnEnemy(id: string, type: EnemyType, x: number, z: number): Enemy {
  return { id, type, x, z, spawnX: x, spawnZ: z, hp: type.hp, state: "idle", t: 0, facing: Math.PI, aim: { x, z }, flash: 0, kx: 0, kz: 0, deadFor: 0 };
}

export type EnemyEvent =
  | { kind: "strike"; enemy: Enemy }           // melee shapes resolved now
  | { kind: "spit"; enemy: Enemy; to: Vec }    // ranged: caller spawns the projectile
  | { kind: "reset"; enemy: Enemy };

/**
 * One tick. `player.safe` = standing in a safe zone: nothing may hit them there,
 * so every enemy gives up, walks home and heals (row 8). Leaving the leash
 * radius does the same.
 */
export function stepEnemy(e: Enemy, player: Vec & { safe: boolean; alive: boolean }, dt: number, free: (x: number, z: number) => boolean = () => true): EnemyEvent | null {
  e.flash = Math.max(0, e.flash - dt);
  if (e.state === "dead") { e.deadFor += dt; return null; }
  // Knockback slides first, blocked by walls.
  if (e.kx || e.kz) {
    const nx = e.x + e.kx * dt, nz = e.z + e.kz * dt;
    if (free(nx, nz)) { e.x = nx; e.z = nz; }
    const decay = Math.exp(-8 * dt); e.kx *= decay; e.kz *= decay;
    if (Math.hypot(e.kx, e.kz) < 0.05) { e.kx = 0; e.kz = 0; }
  }
  const a = e.type.attack;
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
    case "idle":
      if (player.alive && !player.safe && dist < e.type.aggroRadius) { e.state = "chase"; e.t = 0; }
      return null;
    case "return":
      if (move(e.spawnX, e.spawnZ, e.type.speed * 1.5) < 0.05) { e.state = "idle"; e.hp = e.type.hp; e.facing = Math.PI; return { kind: "reset", enemy: e }; }
      return null;
    case "chase": {
      const reach = a.shape === "spit" ? a.range * 0.8 : a.range * 0.8;
      if (dist > reach) { move(player.x, player.z, e.type.speed); return null; }
      e.state = "windup"; e.t = 0; e.facing = facingTo(e, player); e.aim = { x: player.x, z: player.z };
      return null;
    }
    case "windup":
      e.t += dt;
      if (e.t < a.windup) return null;
      e.state = "recover"; e.t = 0;
      return a.shape === "spit" ? { kind: "spit", enemy: e, to: { ...e.aim } } : { kind: "strike", enemy: e };
    case "recover":
      e.t += dt;
      if (e.t >= a.recover) { e.state = "chase"; e.t = 0; }
      return null;
  }
}

/** Does a melee-shaped strike land on the player (from the facing locked at windup)? */
export function strikeLands(e: Enemy, player: Vec, playerRadius = 0.35): boolean {
  const a = e.type.attack;
  return inArc(e, e.facing, a.range, a.shape === "slam" ? Math.PI * 2 : a.arc, player, playerRadius);
}

/** Apply damage + knockback; returns true when this hit kills. Enemies walking home take no damage. */
export function damageEnemy(e: Enemy, amount: number, from: Vec, knock: number): boolean {
  if (e.state === "dead" || e.state === "return") return false;
  e.hp = Math.max(0, e.hp - amount);
  e.flash = 0.18;
  const d = Math.hypot(e.x - from.x, e.z - from.z) || 1;
  const k = e.type.kind === "boss" ? knock * 0.1 : e.type.kind === "construct" ? knock * 0.5 : knock;
  e.kx = ((e.x - from.x) / d) * k; e.kz = ((e.z - from.z) / d) * k;
  if (e.state === "idle") { e.state = "chase"; e.t = 0; }
  if (e.hp === 0) { e.state = "dead"; e.deadFor = 0; return true; }
  return false;
}

/** Placeholder damage roll: weapon damage scaled by tier and level, ±10%. */
export function rollDamage(base: number, tier: number, level: number, random = Math.random): number {
  return Math.round(base * (1 + (tier - 1) * 0.35) * (1 + (level - 1) * 0.04) * (0.9 + random() * 0.2));
}
