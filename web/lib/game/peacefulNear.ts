/**
 * Nearest peaceful interaction (forage node, bug, beach bottle) for the world's
 * single E prompt: each source (VillageLife, the message bottle) writes its own
 * nearest every frame, the scene reads the closest when nothing else is closer.
 * Module state, no React subscription (critterStore pattern).
 */
export interface PeacefulTarget { id: string; kind: "forage" | "bug"; label: string; distance: number }
const nearest = new Map<string, PeacefulTarget | null>();
export function setPeacefulTarget(target: PeacefulTarget | null, source = "life"): void { nearest.set(source, target); }
export function getPeacefulTarget(): PeacefulTarget | null {
  let best: PeacefulTarget | null = null;
  for (const t of nearest.values()) if (t && (!best || t.distance < best.distance)) best = t;
  return best;
}
