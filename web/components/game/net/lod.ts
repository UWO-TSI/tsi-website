/**
 * Render tiers for the players in view (specs/multiplayer.md §5.5): Full, Reduced and Hidden. The driver reads each
 * remote's tier for what it plays (one-shots on any drawn tier, effects at Full only).
 */

export const FULL = 0, REDUCED = 1, HIDDEN = 2;
export type Tier = typeof FULL | typeof REDUCED | typeof HIDDEN;

export interface LodEntry {
  /** Horizontal distance from you (world units). */
  dist: number;
  /** In the camera's frustum. */
  inView: boolean;
  /** A phone rester (FLAG.mobile). */
  phone: boolean;
  /** Has an aura to show: their "show class" is on and they have a subclass kit or a family. */
  hasAura: boolean;
  tier: Tier;
  aura: boolean;
  plate: boolean;
}
export const createLodEntry = (): LodEntry => ({ dist: Infinity, inView: false, phone: false, hasAura: false, tier: FULL, aura: false, plate: false });
