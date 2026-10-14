/**
 * The shared skull (head fit, specs/characters/head-fit.md; ledger row 304): the fit points every hairstyle, hat and
 * head accessory is fitted to, exported by art/characters/skull/skull.py and copied here by
 * scripts/sync-character-assets.mjs. Positions and frames are in the part GLBs' space (glTF: Y up, the face toward
 * +Z), so an accessory authored at a fit point's frame drops onto it with the frame's matrix.
 */
import skull from "@/data/characters/skull.json";

export interface SkullAnchor { lat: number; lon: number; /** Position (glTF). */ p: [number, number, number]; /** Frame rotation, quaternion x, y, z, w: z out of the skull, y up the surface. */ q: [number, number, number, number]; use: string }
export const SKULL = skull as unknown as {
  version: string; centre: [number, number, number];
  anchors: Record<string, SkullAnchor>;
  lines: { hairline: [number, number][]; hatline: [number, number][]; nape: [number, number][]; ear: { lat: number; lon: number; radius_deg: number; top_lat: number } };
  shells: { inner: number; hat_clear: number; hair_vol: [number, number][]; hair_outer: [number, number][] };
  covers: Record<string, string[]>;
  clearance: Record<string, unknown>;
};
/** Every fit point, in the order the skull declares them. */
export const SKULL_ANCHORS = Object.keys(SKULL.anchors);
export function skullAnchor(name: string): SkullAnchor {
  const a = SKULL.anchors[name];
  if (!a) throw new Error(`The skull has no fit point ${name}`);
  return a;
}
