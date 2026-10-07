/**
 * Nearest peaceful interaction (forage node, bug, beach bottle) for the world's
 * single E prompt: each source (VillageLife, the message bottle) writes its own
 * nearest every frame, the scene reads the closest when nothing else is closer.
 * Module state; the prompt's label is the one subscribed value, published only
 * when it changes (walking from a branch to a shell renames the prompt).
 */
import type { ClipName } from "./character/clips";

/**
 * `dig`: a shovel find (buried clam, rock), gathered like forage but with the shovel's left click. `at`: where to turn
 * to. `clip`: the act's own clip (a tree's Shake, a Pickup off the ground, a rock's Strike), else the kind's.
 */
export interface PeacefulTarget { id: string; kind: "forage" | "bug" | "dig"; label: string; distance: number; at?: [number, number]; clip?: ClipName }
const nearest = new Map<string, PeacefulTarget | null>();
const listeners = new Set<() => void>();
let label: string | null = null;
export function setPeacefulTarget(target: PeacefulTarget | null, source = "life"): void {
  nearest.set(source, target);
  const next = getPeacefulTarget()?.label ?? null;
  if (next !== label) { label = next; listeners.forEach(l => l()); }
}
export function getPeacefulTarget(): PeacefulTarget | null {
  let best: PeacefulTarget | null = null;
  for (const t of nearest.values()) if (t && (!best || t.distance < best.distance)) best = t;
  return best;
}
/** The nearest target's label, for useSyncExternalStore. */
export const peacefulLabel = (): string | null => label;
export function subscribePeacefulLabel(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
