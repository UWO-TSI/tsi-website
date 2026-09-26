/**
 * Nearest peaceful interaction (forage node or bug) for the world's single E
 * prompt: VillageLife writes it every frame, the scene reads it when nothing
 * else is closer. Module state, no React subscription (critterStore pattern).
 */
export interface PeacefulTarget { id: string; kind: "forage" | "bug"; label: string; distance: number }
let nearest: PeacefulTarget | null = null;
export function setPeacefulTarget(target: PeacefulTarget | null): void { nearest = target; }
export function getPeacefulTarget(): PeacefulTarget | null { return nearest; }
