/**
 * Character look (rows 110, 134, 135, 137, 143, 191, 192): which catalogue
 * parts and palette colours one character wears, plus the rules that keep a
 * look valid. Pure data; the three.js assembly lives in rig.ts.
 *
 * The catalogue, palette and face layers are copies of art/characters made
 * by scripts/sync-character-assets.mjs (look.test.ts checks they match).
 */
import catalog from "@/data/characters/character_catalog.json";
import palette from "@/data/characters/palette.json";
import faceVariants from "@/data/characters/face_variants.json";

export const CHARACTER_ROOT = "/assets/characters/v6/";
export const BASE_URL = `${CHARACTER_ROOT}base/v6_clips.glb`;
export const FACE_ATLAS_URL = `${CHARACTER_ROOT}base/v6_face_features.png`;
/** Ruling 24: the crewneck carries the site's own TSI mark (public/logo.svg, rasterised by the sync script). */
export const TSI_DECAL_URL = `${CHARACTER_ROOT}decal_tsi_mark.png`;

export type PartSlot = "bangs" | "back" | "top" | "bottom" | "onepiece" | "shoes" | "accessory";
/** Accessory sub-slots, one item each (ruling 21). */
export type AccGroup = "face" | "head" | "bag" | "neck";
export interface PartMaterial { name: string; tint?: "outfit" | "hair" | null; default?: number | string | null; decal?: boolean; color?: string }
export interface CatalogPart {
  id: string; slot: PartSlot; name: string; glb: string; tris: number; materials: PartMaterial[];
  hidesBackHair: boolean; hides: string[]; variantOf?: string; group?: AccGroup;
}
export interface ClipInfo { name: string; length: number; loop: boolean; endsNeutral?: boolean; endsOn?: string; seatHeight?: number; deskHeight?: number; hand?: "L" | "R" }

export const PARTS = [...catalog.outfits, ...catalog.accessories, ...catalog.hair] as CatalogPart[];
export const PART_BY_ID = new Map(PARTS.map(p => [p.id, p]));
export const CLIPS = catalog.clips as ClipInfo[];
export const CLIP_BY_NAME = new Map(CLIPS.map(c => [c.name, c]));
export const PALETTE = { skin: palette.skin, hair: palette.hair, outfit: palette.outfit };
export const FACE = faceVariants as unknown as {
  canvas: number; atlas_size: [number, number]; compose_order: FaceLayer[];
  layers: Record<FaceLayer, { dest: [number, number, number, number]; default: string | null; multi: boolean; tint: "hair" | null; items: Record<string, [number, number, number, number]> }>;
};
export type FaceLayer = "extras" | "brows" | "eyes" | "mouth";
export const partsIn = (slot: PartSlot) => PARTS.filter(p => p.slot === slot);

export interface CharacterLook {
  skin: number; hair: number;
  eyes: string; mouth: string; brows: string; extras: string[];
  bangs: string; back: string;
  top: string | null; bottom: string | null; onepiece: string | null; shoes: string | null;
  acc: Partial<Record<AccGroup, string>>;
  /** Outfit palette index per part id for its first outfit-tinted material; others keep catalogue defaults. */
  colors: Record<string, number>;
}

export const DEFAULT_LOOK: CharacterLook = {
  skin: palette.base_body_defaults.skin, hair: palette.ref_girl_defaults.hair,
  eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [],
  bangs: "bangs_straight", back: "back_bob",
  top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {},
};

const inSlot = (id: unknown, slot: PartSlot): id is string => typeof id === "string" && PART_BY_ID.get(id)?.slot === slot;
const index = (v: unknown, n: number, fallback: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? v as number : fallback;
const faceItem = (layer: FaceLayer, v: unknown, fallback: string) => typeof v === "string" && v in FACE.layers[layer].items ? v : fallback;
const hood = (look: CharacterLook) => !!look.onepiece && !!PART_BY_ID.get(look.onepiece)?.hidesBackHair;

/** Validate anything (localStorage, profile JSON) into a wearable look; bad fields fall back to the default. */
export function parseLook(raw: unknown): CharacterLook {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_LOOK;
  const onepiece = inSlot(r.onepiece, "onepiece") ? r.onepiece : null;
  const acc: CharacterLook["acc"] = {};
  if (r.acc && typeof r.acc === "object") for (const [group, id] of Object.entries(r.acc)) {
    const part = typeof id === "string" ? PART_BY_ID.get(id) : undefined;
    if (part?.slot === "accessory" && part.group === group) acc[group as AccGroup] = id as string;
  }
  const colors: Record<string, number> = {};
  if (r.colors && typeof r.colors === "object") for (const [id, v] of Object.entries(r.colors)) if (PART_BY_ID.has(id)) colors[id] = index(v, PALETTE.outfit.length, 0);
  const look: CharacterLook = {
    skin: index(r.skin, PALETTE.skin.length, d.skin), hair: index(r.hair, PALETTE.hair.length, d.hair),
    eyes: faceItem("eyes", r.eyes, d.eyes), mouth: faceItem("mouth", r.mouth, d.mouth), brows: faceItem("brows", r.brows, d.brows),
    extras: Array.isArray(r.extras) ? [...new Set(r.extras.filter((e): e is string => typeof e === "string" && e in FACE.layers.extras.items))] : [],
    bangs: inSlot(r.bangs, "bangs") ? r.bangs : d.bangs, back: inSlot(r.back, "back") ? r.back : d.back,
    top: onepiece ? null : inSlot(r.top, "top") ? r.top : d.top,
    bottom: onepiece ? null : inSlot(r.bottom, "bottom") ? r.bottom : d.bottom,
    onepiece, shoes: r.shoes === null ? null : inSlot(r.shoes, "shoes") ? r.shoes : d.shoes, acc, colors,
  };
  if (hood(look)) delete look.acc.head; // a hood and a hat never stack
  return look;
}

/**
 * Put a part on (or take it off with null / a second tap on an accessory).
 * A one-piece replaces top and bottom; a top or bottom replaces a one-piece;
 * a hat and a hood replace each other, the later choice winning (ruling 21).
 */
export function wear(look: CharacterLook, slot: PartSlot, id: string | null): CharacterLook {
  const next: CharacterLook = { ...look, acc: { ...look.acc } };
  if (slot === "accessory") {
    const part = id ? PART_BY_ID.get(id) : undefined;
    if (!part?.group) return next;
    if (next.acc[part.group] === id) delete next.acc[part.group];
    else {
      next.acc[part.group] = part.id;
      if (part.group === "head" && hood(next)) next.onepiece = PART_BY_ID.get(next.onepiece!)!.variantOf ?? null;
    }
    if (!next.onepiece && !next.top) { next.top = DEFAULT_LOOK.top; next.bottom = DEFAULT_LOOK.bottom; }
    return next;
  }
  if (id !== null && !inSlot(id, slot)) return next;
  if (slot === "onepiece") {
    next.onepiece = id;
    if (id) { next.top = null; next.bottom = null; if (hood(next)) delete next.acc.head; }
    else { next.top = DEFAULT_LOOK.top; next.bottom = DEFAULT_LOOK.bottom; }
    return next;
  }
  if (slot === "top" || slot === "bottom") {
    if (!id) return next; // top and bottom are always worn unless a one-piece covers them
    if (next.onepiece) { next.onepiece = null; next.top = DEFAULT_LOOK.top; next.bottom = DEFAULT_LOOK.bottom; }
    next[slot] = id;
    return next;
  }
  if (slot === "shoes") { next.shoes = id; return next; }
  if (id) next[slot] = id;
  return next;
}

/** Every part a look wears, in draw order. */
export function wornParts(look: CharacterLook): CatalogPart[] {
  const ids = [look.bangs, look.back, look.onepiece ?? look.top, look.onepiece ? null : look.bottom, look.shoes, ...Object.values(look.acc)];
  const parts = ids.filter((id): id is string => !!id).map(id => PART_BY_ID.get(id)!).filter(Boolean);
  // Hats and hoods hide the back hair (they carry their own tuck, ruling 20).
  return parts.some(p => p.hidesBackHair) ? parts.filter(p => p.slot !== "back") : parts;
}

export interface ResolvedPart { id: string; url: string; tints: Record<string, string>; decal: string | null }
/** Parts with their GLB URL and one sRGB hex per tinted material; decal materials without art are dropped. */
export function resolveParts(look: CharacterLook): ResolvedPart[] {
  return wornParts(look).map(part => {
    const tints: Record<string, string> = {};
    let decal: string | null = null;
    let first = true;
    for (const m of part.materials) {
      if (m.decal) { if (m.default) decal = TSI_DECAL_URL; continue; }
      if (m.tint === "hair") tints[m.name] = PALETTE.hair[look.hair];
      else if (m.tint === "outfit") {
        tints[m.name] = PALETTE.outfit[first && part.id in look.colors ? look.colors[part.id] : (m.default as number)];
        first = false;
      } else if (m.color) tints[m.name] = m.color;
    }
    return { id: part.id, url: CHARACTER_ROOT + part.glb, tints, decal };
  });
}

/** The editable colour of a part: its first outfit-tinted material. */
export function partColor(look: CharacterLook, id: string): number | null {
  const m = PART_BY_ID.get(id)?.materials.find(x => x.tint === "outfit");
  return m ? look.colors[id] ?? (m.default as number) : null;
}

/** Cache key for the merged body mesh (face and pose excluded). */
export const bodyKey = (look: CharacterLook) => JSON.stringify([look.skin, look.hair, resolveParts(look).map(p => [p.id, p.tints, p.decal])]);
export const faceKey = (look: CharacterLook) => [look.skin, look.hair, look.brows, look.eyes, look.mouth, ...look.extras].join("|");

/** Small seeded PRNG (mulberry32) so residents get the same random look every visit. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashSeed = (s: string) => Array.from(s).reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Creator "surprise me" and the skip default (row 142): a complete random look. */
export function randomLook(rand: () => number = Math.random): CharacterLook {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const ids = (slot: PartSlot) => partsIn(slot).filter(p => !p.variantOf).map(p => p.id);
  let look: CharacterLook = {
    ...DEFAULT_LOOK,
    skin: Math.floor(rand() * PALETTE.skin.length), hair: Math.floor(rand() * PALETTE.hair.length),
    eyes: pick(Object.keys(FACE.layers.eyes.items)), mouth: pick(Object.keys(FACE.layers.mouth.items).filter(m => m.startsWith("M"))),
    extras: rand() < 0.3 ? ["blush"] : [], bangs: pick(ids("bangs")), back: pick(ids("back")), shoes: pick(ids("shoes")), acc: {}, colors: {},
  };
  look = rand() < 0.2 ? wear(look, "onepiece", pick(ids("onepiece"))) : wear(wear(look, "top", pick(ids("top"))), "bottom", pick(ids("bottom")));
  for (const id of [look.top, look.bottom, look.onepiece]) if (id && rand() < 0.6) look.colors[id] = Math.floor(rand() * PALETTE.outfit.length);
  if (rand() < 0.45) look = wear(look, "accessory", pick(ids("accessory")));
  return look;
}
