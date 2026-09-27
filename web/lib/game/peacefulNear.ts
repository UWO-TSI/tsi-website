/**
 * Nearest peaceful interaction (forage node, bug, beach bottle) for the world's
 * single E prompt: each source (VillageLife, the message bottle) writes its own
 * nearest every frame, the scene reads the closest when nothing else is closer.
 * Module state, no React subscription.
 */
/** `dig`: a shovel find (buried clam, rock), gathered like forage but played with the Dig clip. `at`: where to turn to. */
export interface PeacefulTarget { id: string; kind: "forage" | "bug" | "dig"; label: string; distance: number; at?: [number, number] }
const nearest = new Map<string, PeacefulTarget | null>();
export function setPeacefulTarget(target: PeacefulTarget | null, source = "life"): void { nearest.set(source, target); }
export function getPeacefulTarget(): PeacefulTarget | null {
  let best: PeacefulTarget | null = null;
  for (const t of nearest.values()) if (t && (!best || t.distance < best.distance)) best = t;
  return best;
}
