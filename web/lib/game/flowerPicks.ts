"use client";

/**
 * Flower-pick store (cozy marathon G4). Tracks which flower clusters are
 * currently picked (hidden) so the instanced renderer can skip them, then
 * respawns each after a delay — ACNH flowers regrow, and a portal village
 * shouldn't strip bare. Picked state is session-local; the *collection*
 * (what you picked) persists via /api/collections.
 */

const RESPAWN_MS = 45_000;
const picked = new Set<number>();
const listeners = new Set<() => void>();
let snapshot: readonly number[] = [];

function emit() {
  snapshot = [...picked];
  for (const l of listeners) l();
}

export function pickFlower(index: number): boolean {
  if (picked.has(index)) return false;
  picked.add(index);
  emit();
  window.setTimeout(() => {
    picked.delete(index);
    emit();
  }, RESPAWN_MS);
  return true;
}

export function subscribeFlowerPicks(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPickedSnapshot(): readonly number[] {
  return snapshot;
}

export function getPickedServerSnapshot(): readonly number[] {
  return snapshot;
}
