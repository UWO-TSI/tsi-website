/**
 * Dodge i-frames (rows 49, 50, C3) and enemy aggro / safe-zone reset (row 8).
 * Pure timing and state rules; the island agent's controller calls them.
 */

// ── Dodge ─────────────────────────────────────────────────────────────────────
export const DODGE = { duration_ms: 420, iframe_start_ms: 60, iframe_end_ms: 320, cooldown_ms: 900 } as const;

/** Invulnerable only inside the i-frame window of the latest dodge. */
export function isInvulnerable(dodgeStartedAt: number | null, now: number): boolean {
  if (dodgeStartedAt === null) return false;
  const t = now - dodgeStartedAt;
  return t >= DODGE.iframe_start_ms && t < DODGE.iframe_end_ms;
}
export function canDodge(lastDodgeAt: number | null, now: number): boolean {
  return lastDodgeAt === null || now - lastDodgeAt >= DODGE.cooldown_ms;
}
/** C3: dodging cancels an in-progress incantation (the casting cost is lost). */
export function dodgeCancelsCast(casting: boolean): { cancelled: boolean } {
  return { cancelled: casting };
}

// ── Aggro ─────────────────────────────────────────────────────────────────────
export type AggroState = "idle" | "chase" | "attack" | "return";
export interface Vec2 {
  x: number;
  z: number;
}
export interface EnemyAggro {
  state: AggroState;
  home: Vec2;
  pos: Vec2;
  hp: number;
  max_hp: number;
  aggro_radius: number;
  attack_range: number;
  leash_radius: number; // max distance from home before giving up
}
export interface SafeZone {
  contains(p: Vec2): boolean;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * One aggro step. The village/safe zone rejects hostility: a target inside it
 * is never chased, and an enemy that has lost its target walks home and heals
 * to full once back (so it can't be chipped down from safety).
 */
export function aggroStep(e: EnemyAggro, player: Vec2 | null, safe: SafeZone): EnemyAggro {
  const targetable = player !== null && !safe.contains(player);
  const d = player ? dist(e.pos, player) : Infinity;
  const fromHome = dist(e.pos, e.home);
  if (e.state === "return") {
    if (fromHome < 0.5) return { ...e, state: "idle", pos: { ...e.home }, hp: e.max_hp };
    return e;
  }
  if (!targetable || fromHome > e.leash_radius) {
    return e.state === "idle" ? e : { ...e, state: "return" };
  }
  if (d <= e.attack_range) return { ...e, state: "attack" };
  if (e.state !== "idle" || d <= e.aggro_radius) return { ...e, state: "chase" };
  return e;
}

/** Hostile damage never lands on a player standing in a safe zone (row 8). */
export function hostileHitAllowed(target: Vec2, safe: SafeZone): boolean {
  return !safe.contains(target);
}
