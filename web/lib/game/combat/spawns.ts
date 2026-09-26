/**
 * Where the encounter's enemies stand (ruins.ts layout). Outer wild: the three
 * wildlife types (shadow fox, thorn crab, mushroom beast); inner temple: the
 * stone golem construct; the guardian statue in its chamber. Ids are the
 * systems roster keys (web/lib/combat/content.ts).
 */
export interface SpawnPoint { id: string; type: string; x: number; z: number }
export const SPAWNS: SpawnPoint[] = [
  { id: "fx1", type: "shadow-fox", x: -7, z: -18 }, { id: "fx2", type: "shadow-fox", x: 6, z: -19.5 }, { id: "fx3", type: "shadow-fox", x: 11, z: -9 },
  { id: "fx4", type: "shadow-fox", x: -10, z: -12 }, { id: "fx5", type: "shadow-fox", x: 11, z: -16 }, { id: "fx6", type: "shadow-fox", x: -3, z: -9 },
  { id: "cr1", type: "thorn-crab", x: -8, z: -8 }, { id: "cr2", type: "thorn-crab", x: 3.5, z: -7 },
  { id: "mb1", type: "mushroom-beast", x: -3, z: -15 }, { id: "mb2", type: "mushroom-beast", x: 12, z: -9.5 },
  { id: "gl1", type: "stone-golem", x: -5.5, z: 6 }, { id: "gl2", type: "stone-golem", x: 5.5, z: 9 },
  { id: "boss", type: "guardian-statue", x: 0, z: 25.5 },
];
/** Waves for "Hold the rune circle": they come in from the circle's edges. */
export const WAVES: SpawnPoint[][] = [
  [{ id: "wv1a", type: "shadow-fox", x: 3.2, z: -14 }, { id: "wv1b", type: "shadow-fox", x: 9.8, z: -14 }],
  [{ id: "wv2a", type: "mushroom-beast", x: 6.5, z: -10.7 }, { id: "wv2b", type: "shadow-fox", x: 6.5, z: -17.3 }, { id: "wv2c", type: "thorn-crab", x: 9.5, z: -11.5 }],
  [{ id: "wv3a", type: "thorn-crab", x: 3.5, z: -11.5 }, { id: "wv3b", type: "shadow-fox", x: 9.8, z: -16.5 }, { id: "wv3c", type: "shadow-fox", x: 3.4, z: -16.8 }],
];
