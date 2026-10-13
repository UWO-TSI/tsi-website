/**
 * What lies on the seabed in the shallows (v1 water item 2, specs/v1-drop.md §8c.1): faceted boulders, seagrass, kelp
 * and coral-like plants (art/water/build_seabed.py), drawn instanced (components/game/water/Seabed.tsx). Where each one
 * goes is a property of the map: seeded by its cell, so every client has the same seabed (look spec §7.1). Each kind
 * keeps to the depths it suits; the tall boulder stands in water shallow enough that it breaks the surface, and those
 * are listed so the water can ring them with foam.
 */
import { LEVEL_STEP, WATER_DROP, cellToWorldX, cellToWorldZ, isGroundAtWorld, isWater, levelAt, surfaceAt, type IslandMap, type ShoreSdf } from "./grid";
import { seabedDip } from "./seabed";

export interface SeabedKind {
  /** The node in seabed.glb. */
  name: string;
  /** Depths of water it grows in (world units over the bed). */
  depth: readonly [number, number];
  /** Chance per candidate spot (four a cell). */
  chance: number;
  /** Scale range. */
  scale: readonly [number, number];
  /** Its model's height (seabed.glb bounds), for what breaks the surface. */
  height: number;
  /** Drawn on Lite too. */
  lite: boolean;
  /** Sways in the water (the shader bends it by height on the world clock). */
  sway: boolean;
  /** Each instance's colour is picked from these (sRGB hex, multiplied over the model's own). */
  tints: readonly number[];
}

/** The kinds, in draw order. Corals are white in the model: their tints are their colours. */
export const SEABED_KINDS: readonly SeabedKind[] = [
  { name: "seagrass_a", depth: [0.14, 0.85], chance: 0.16, scale: [0.8, 1.35], height: 0.4, lite: true, sway: true, tints: [0xffffff, 0xe6f0d0, 0xd4e8c2] },
  { name: "seagrass_b", depth: [0.55, 1.9], chance: 0.035, scale: [0.85, 1.4], height: 0.82, lite: false, sway: true, tints: [0xffffff, 0xd9e2b4] },
  { name: "boulder_a", depth: [0.12, 2.2], chance: 0.03, scale: [0.7, 1.4], height: 0.19, lite: true, sway: false, tints: [0xffffff, 0xe9e4da, 0xd6dcd8] },
  { name: "boulder_b", depth: [0.12, 2.2], chance: 0.022, scale: [0.7, 1.3], height: 0.16, lite: true, sway: false, tints: [0xffffff, 0xe2ddd2] },
  { name: "boulder_c", depth: [0.16, 0.6], chance: 0.012, scale: [0.85, 1.2], height: 1.05, lite: false, sway: false, tints: [0xffffff, 0xe9e6de] },
  { name: "coral_bush", depth: [0.3, 1.45], chance: 0.035, scale: [0.9, 1.5], height: 0.38, lite: false, sway: false, tints: [0xf08a4b, 0xe8664a, 0xf2b34a, 0xd9566e] },
  { name: "coral_fan", depth: [0.4, 1.6], chance: 0.025, scale: [0.9, 1.6], height: 0.43, lite: false, sway: true, tints: [0xe9704f, 0xc75a8f, 0xf0a04b] },
  { name: "coral_tube", depth: [0.4, 1.5], chance: 0.022, scale: [0.9, 1.4], height: 0.34, lite: false, sway: false, tints: [0xb77ac4, 0xe58a9c, 0xf3c46a, 0x7fc4c0] },
];

export interface SeabedItem { x: number; y: number; z: number; yaw: number; scale: number; tint: number }
export interface SeabedLayout {
  items: Record<string, SeabedItem[]>;
  /** The rocks whose tops stand out of the water: centre and the radius where they meet the surface. */
  breaking: { x: number; z: number; r: number; top: number }[];
}

/** A cell's own random stream (a hash of its place and a salt): the same on every client. */
function cellRandom(cx: number, cz: number, salt: number) {
  let h = Math.imul(cx | 0, 0x9e3779b1) ^ Math.imul((cz | 0) + 0x632be5ab, 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae35);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seabed's props on a map: four candidate spots a cell over the sea's water (level 0), each taking at most one
 * kind whose depth suits it. `skip`: spots to leave clear (under the wharf's deck). `lite`: Lite's cheaper seabed (the
 * kinds marked `lite`, at 45% of the density).
 */
export function seabedProps(map: IslandMap, shore: ShoreSdf, { skip, lite = false }: { skip?: (x: number, z: number) => boolean; lite?: boolean } = {}): SeabedLayout {
  const items: Record<string, SeabedItem[]> = Object.fromEntries(SEABED_KINDS.map(k => [k.name, []]));
  const breaking: SeabedLayout["breaking"] = [];
  const surface = -WATER_DROP;
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (!isWater(surfaceAt(map, cx, cz)) || levelAt(map, cx, cz) * LEVEL_STEP !== 0) continue;
    const rnd = cellRandom(cx, cz, 0x5eab), x0 = cellToWorldX(map, cx), z0 = cellToWorldZ(map, cz);
    for (let k = 0; k < 4; k++) {
      const x = x0 + ((k & 1) - 0.5) * 0.5 + (rnd() - 0.5) * 0.45, z = z0 + ((k >> 1) - 0.5) * 0.5 + (rnd() - 0.5) * 0.45;
      const roll = rnd(), yaw = rnd() * Math.PI * 2, s = rnd(), tint = rnd(), thin = rnd();
      if (isGroundAtWorld(map, x, z) || skip?.(x, z)) continue;
      const dip = seabedDip(map, shore, x, z);
      // One roll down the kinds' chances: a spot takes the first whose share of the roll it falls in.
      let acc = 0;
      for (const kind of SEABED_KINDS) {
        acc += kind.chance;
        if (roll >= acc) continue;
        if (dip < kind.depth[0] || dip > kind.depth[1] || (lite && (!kind.lite || thin > 0.45))) break;
        const rock = kind.name.startsWith("boulder"), y = surface - dip;
        let scale = kind.scale[0] + (kind.scale[1] - kind.scale[0]) * s;
        // Plants stay under the water: one too tall for the depth here grows smaller, or not at all.
        if (!rock) scale = Math.min(scale, (dip - 0.06) / kind.height);
        if (scale < kind.scale[0] * 0.6) break;
        items[kind.name].push({ x, y, z, yaw, scale, tint });
        const top = y + kind.height * scale;
        // A rock that stands out of the water, ringed with foam where it meets it (a third of its footprint's span).
        if (rock && top > surface + 0.03) breaking.push({ x, z, r: (kind.name === "boulder_c" ? 0.3 : 0.38) * scale, top });
        break;
      }
    }
  }
  return { items, breaking };
}
