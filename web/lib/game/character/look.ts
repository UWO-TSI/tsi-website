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
import faceV7 from "@/data/characters/face_v7.json";
import batch2Pricing from "@/data/characters/batch2-pricing.json";
import { LOOK_MAX_BYTES } from "@/lib/net/protocol";
import { hairShift, NO_SHIFT, oklabToHex, oklchToOklab, shiftedMedian, type HairShift, type Oklch } from "./hairColour";

export const CHARACTER_ROOT = "/assets/characters/v6/";
/** The clip-bearing base: the v6 body with the hand-modeled v7 head (avatar v7). */
export const BASE_URL = `${CHARACTER_ROOT}${catalog.base.clips_glb}`;
/** LOD 1 (art/characters/build_lod.py): every part decimated on the same rig, and the base's skin alone (the face, head and clips stay the base's). */
export const LOD_ROOT = `${CHARACTER_ROOT}lod1/`;
export const LOD_SKIN_URL = `${LOD_ROOT}base/skin.glb`;
/** LOD 2 (head-roblox): the whole hairstyles at about 1,100 triangles for characters far and small; other parts use LOD 1. */
export const LOD2_ROOT = `${CHARACTER_ROOT}lod2/`;
/** The face layer atlas: 1024 px per face canvas in the creator, the 512 copy in the world (same layout). */
export const FACE_ATLAS_URLS = { creator: `${CHARACTER_ROOT}base/${faceV7.atlas}`, world: `${CHARACTER_ROOT}base/${faceV7.atlas_world}` };
/** Round 2 (David, 2026-10-17): every mapped hairstyle's own source texture, one cell a piece (art/characters/hair/
 * import_hair.py natural_map): RGB as drawn in Roblox, alpha its recolour channel (1 the hair's colour, 2/3 its second, 1/3
 * fixed), at 512 px a cell (the creator) and its half-size copy (the world, as the face atlas). A picked colour is a hue
 * and saturation shift of it (hairColour.ts, Character.tsx). */
export const HAIR_MAPS_URLS = { creator: `${CHARACTER_ROOT}${catalog.hairMaps.atlas}`, world: `${CHARACTER_ROOT}${catalog.hairMaps.atlas_world}` };
/** Its second page (David's 19 faces, face_set_305.py), loaded only for a look that wears one of them. */
export const FACE_ATLAS2_URLS = { creator: `${CHARACTER_ROOT}base/${faceV7.atlas2}`, world: `${CHARACTER_ROOT}base/${faceV7.atlas2_world}` };
/** head-v10 (row 311): each whole hairstyle's creator tile, baked once at build time (scripts/bake-hair-thumbs.mjs) in its
 * own colours (round 2) on the default head: the tiles never redraw when the colour changes, and show at once. */
export const HAIR_THUMB_URL = (id: string) => `${CHARACTER_ROOT}hair/thumbs/${id}.webp`;
/** Wardrobe batch 2: the fixed-colour atlas (art/characters/colour_atlas.py): David's Roblox accessories and #22's hat keep
 * their own textures. A vertex whose u is 2 or more draws the texel at (u - 2, v), never tinted (Character.tsx). */
export const COLOUR_ATLAS_URL = `${CHARACTER_ROOT}colour_atlas.png`;
/** Ruling 24: the crewneck carries the site's own TSI mark (public/logo.svg, rasterised by the sync script). */
export const TSI_DECAL_URL = `${CHARACTER_ROOT}decal_tsi_mark.png`;

export type PartSlot = "bangs" | "back" | "top" | "bottom" | "onepiece" | "shoes" | "accessory";
/** Accessory sub-slots, one item each (ruling 21); `front` (a tie on the chest) came with wardrobe batch 2. */
export type AccGroup = "face" | "head" | "bag" | "neck" | "front";
export interface PartMaterial { name: string; tint?: "outfit" | "hair" | null; default?: number | string | null; decal?: boolean; color?: string }
export interface CatalogPart {
  id: string; slot: PartSlot; name: string; glb: string; tris: number; materials: PartMaterial[];
  hidesBackHair: boolean; hides: string[]; variantOf?: string; group?: AccGroup;
  /** A whole hairstyle in the back slot (head fit): the bangs are not worn with it. */
  full?: boolean;
  /** Its cell in the hair texture atlas (HAIR_MAPS_URLS) and each recolour channel's median (OKLCh): `a` the hair's colour,
   * `b` a two-colour hair's second; `fixed`: some of it (a cap, a visor) is never recoloured. */
  map?: { cell: number; natural: { a?: Oklch; b?: Oklch }; fixed?: boolean };
  /** A two-tone style's second colour: a hair palette index, or "skin" (a fade to the skin), unless the look picks one;
   * an sRGB hex is a fixed colour no look changes (a split-off visor's logo). */
  accent?: { default: number | "skin" | string };
  /** Attached the Roblox way (head-roblox): by its own HairAttachment from hair/roblox_attachments.json; provisional: the
   * attachment is a seat fit until David copies the real one from Studio. Wardrobe batch 2's accessories name theirs
   * (accessories/roblox_attachments.json). */
  roblox?: { provisional: boolean; attachment?: string };
  /** Wardrobe batch 2: the item's key in specs/wardrobe/batch2-pricing.json (its mode and price: priceOf). */
  key?: string;
  /** Some of its texels come from the fixed-colour atlas (COLOUR_ATLAS_URL): a Roblox accessory, #22's hat. */
  colourAtlas?: boolean;
  /** A hat whose crown closes over the hair: a look wearing it draws none of the hair it hides (the hair's `_HATCUT`
   * marks, art/characters/hidden_cut.py; rig.ts). */
  coversHair?: boolean;
  /** Its bit in the hair's `_HATCUT` marks (hidden_cut.py hatcut). */
  hatCut?: number;
  /** The bear hood: a look wearing it draws none of the head skin it hides (the base's `_HOODCUT` marks). */
  coversHead?: boolean;
  /** Owned with that part, never sold alone (row 314: #22's ushanka and goggles come with hair #22). */
  grantedBy?: string;
  /** The economy item (crafted) that unlocks this part; its catalogue_ref is this part's id. Such parts are never sold. */
  item?: string;
  /**
   * An event costume (the traditions calendar, lib/content/traditions.ts): the tradition whose costume closet makes it
   * free to wear while it runs. Never sold; offered, worn and drawn only then (eventPartOpen).
   */
  event?: string;
}
export interface ClipInfo { name: string; length: number; loop: boolean; endsNeutral?: boolean; endsOn?: string; seatHeight?: number; deskHeight?: number; hand?: "L" | "R";
  /** Locomotion loops: where each foot comes down, as phases [left, right] (build_clips.py measures them). */
  contacts?: number[];
  /** Posed by a phase the engine sets (Air: by vertical speed), not played on a clock. */
  scrub?: boolean;
  /** One-shots: the phases where a hand or the tool makes contact (the grab, the strike, each hammer blow; lib/game/actTiming.ts). */
  hits?: number[];
  /** CastSwing: the phase the bobber leaves the rod's tip. */
  release?: number;
  /** HookYank: the phase the rod snaps up (the line goes taut). */
  impact?: number }

export const PARTS = [...catalog.outfits, ...catalog.accessories, ...catalog.hair, ...catalog.robloxAccessories] as CatalogPart[];
export const PART_BY_ID = new Map(PARTS.map(p => [p.id, p]));
export const CLIPS = catalog.clips as ClipInfo[];
export const CLIP_BY_NAME = new Map(CLIPS.map(c => [c.name, c]));
/**
 * The verb library (classes v2, design sheet §1.8; build_clips.py `-- verbs`): `${Verb}_${Grip}` one-shots and a hold
 * idle per grip, in their own GLB that only the ruins load. `impact`: phase of the hit key (hitstop, an ult's freeze);
 * `upper`: it can play on the upper body over locomotion and slides; `hold`: the phase span a held verb loops.
 */
export interface VerbInfo { name: string; verb: string; grip: string; length: number; loop: boolean; frames: number; hand: "L" | "R" | "both"; upper: boolean; impact: number; hold?: [number, number] }
export const VERBS_URL = `${CHARACTER_ROOT}${catalog.verbs.glb}`;
export const VERB_CLIPS = catalog.verbs.clips as VerbInfo[];
export const VERB_BY_NAME = new Map(VERB_CLIPS.map(c => [c.name, c]));
/** The sushi bar staff's clips (build_clips.py `-- staff`): the rig and its actions, loaded by the bar's chef and server (Character `clips`). */
export const STAFF_URL = `${CHARACTER_ROOT}${catalog.staff.glb}`;
export const PALETTE = { skin: palette.skin, hair: palette.hair, outfit: palette.outfit };
/** An atlas cell: rect [x, y, w, h] (px, top-left origin) and the point (ax, ay) in it that sits on its anchor; a 7th
 * value 1 puts it on the second atlas page. */
export type FaceCell = [number, number, number, number, number, number, (0 | 1)?];
export type EyeFrame = "open" | "half" | "closed";
/**
 * The v7 face (art/characters/v7/build_face.py): features drawn once into atlas cells at `density` px per face
 * canvas; the engine places each at its anchor on the face canvas (the head's UVs), mirrored for the other side
 * on mirrored layers, and animates by switching cells (blink frames, talk and emote mouths, expressions).
 */
export const FACE = faceV7 as unknown as {
  density: number; atlas_size: [number, number]; atlas2_size: [number, number];
  /** eye_left: the eye anchor mirrored, where an eye's own `left` cell sits; an accent of set 305 sits on its own. */
  anchors: Record<"eye" | "eye_left" | "eye_pair" | "mouth" | "cheek" | "mole" | "blush", [number, number]> & Record<string, [number, number]>;
  layers: {
    extras: { default: null; multi: true; tint: null; items: Record<string, { anchor: string; mirror: boolean; cell: FaceCell }> };
    /** `left`: the canvas-right eye drawn on its own (set 305's asymmetric pairs); `left: null`: `open` is the whole
     * pair, at eye_pair, drawn once; absent: `open` is one eye, mirrored. */
    eyes: { default: string; anchor: "eye"; mirror: true; tint: null; items: Record<string, Partial<Record<EyeFrame, FaceCell>> & { open: FaceCell; left?: FaceCell | null }> };
    mouth: { default: string; anchor: "mouth"; mirror: false; tint: null; items: Record<string, FaceCell> };
    /** Larger open mouths shown only while talking (not creator options). */
    talk: { default: null; anchor: "mouth"; mirror: false; tint: null; items: Record<string, FaceCell> };
  };
  expressions: Record<string, { eyes: string | null; eyeFrame: EyeFrame; mouth: string | null }>;
  blink: { interval: [number, number]; frames: [EyeFrame, number][] };
  talk: { frames: string[]; rate: number };
  emoteMouth: Record<string, { frames: string[]; rate: number }>;
  /** Creator names of the parts that have no sheet code (face_set_301.py, face_set_305.py). */
  names: Record<string, string>;
  /** Wardrobe batch 2 (face_set_b2.py): David's whole faces by their pricing key; a priced one gates its parts (faceRef). */
  faces: Record<string, { id: string; name: string; eyes: string; mouth: string | null; extras: string[] }>;
};
/**
 * The cells every character can show whatever it wears: the expressions' forced eyes and mouths and the emote mouths.
 * Since the wardrobe cut (playtest round 1) they are David's, on the second page.
 */
const sharedCells = (): (FaceCell | null | undefined)[] => [
  ...Object.values(FACE.expressions).flatMap(e => [...(e.eyes ? Object.values(FACE.layers.eyes.items[e.eyes] ?? {}) : []), e.mouth ? FACE.layers.mouth.items[e.mouth] : undefined]),
  ...Object.values(FACE.emoteMouth).flatMap(m => m.frames.map(f => FACE.layers.mouth.items[f])),
];
const SHARED_PAGE2 = sharedCells().some(c => c?.[6] === 1);
/** Whether a character loads the second atlas page: its look wears a part there, or an expression or emote shows one. */
export function usesFacePage2(look: CharacterLook): boolean {
  const { eyes, mouth, extras } = FACE.layers;
  const cells = [...Object.values(eyes.items[look.eyes] ?? {}), mouth.items[look.mouth], ...look.extras.map(x => extras.items[x]?.cell)];
  return SHARED_PAGE2 || cells.some(c => c?.[6] === 1);
}
/** The face's layers. Eyebrows were removed (playtest round 1, David 2026-10-14): the atlas still holds their cells
 * (art/characters/v7/build_face.py), but no look wears them, no category offers them and the face draws none. */
export type FaceLayer = "extras" | "eyes" | "mouth";
export const partsIn = (slot: PartSlot) => PARTS.filter(p => p.slot === slot);

/**
 * Face placement (the creator's sliders, after the Li'l Lads reference, 2026-10-08): per part, whole steps of
 * [Down–Up, Left–Right (spacing), Rotate, Smaller–Bigger], each -PLACE_STEPS..PLACE_STEPS. Optional and sparse: a
 * part left where it was is absent, so a look without placement is today's face exactly. face.ts turns the steps
 * into the face shader's slot rects and tilt, clamped to the face area.
 */
export type PlacePart = "eyes" | "mouth";
export type Placement = [up: number, apart: number, rotate: number, size: number];
export const PLACE_STEPS = 10;
/** Which sliders each part has: the mouth sits on the centre line, so it has no spacing. */
export const PLACE_PARTS: Record<PlacePart, { apart: boolean }> = { eyes: { apart: true }, mouth: { apart: false } };

/** A look's `hair` when it picks no colour: every hairstyle draws its own texture's colours (round 2, the default). */
export const NATURAL_HAIR = -1;

export interface CharacterLook {
  /** `hair`: a hair palette index, or NATURAL_HAIR (the hairstyle's own colours). */
  skin: number; hair: number;
  eyes: string; mouth: string; extras: string[];
  bangs: string; back: string;
  top: string | null; bottom: string | null; onepiece: string | null; shoes: string | null;
  acc: Partial<Record<AccGroup, string>>;
  /** Outfit palette index per part id for its first outfit-tinted material; others keep catalogue defaults. */
  colors: Record<string, number>;
  /** A two-tone hairstyle's second colour (hair palette index); absent: the style's own. */
  hairAccent?: number;
  /** A custom hair colour from the creator's colour wheel (sRGB "#RRGGBB", head-v10): it tints the hair over the palette
   * index `hair`; absent (every look saved before it): the palette colour. Unlocked by buying the colour wheel (ownsRef). */
  hairColor?: string;
  /** Face placement from the creator's sliders; absent is today's placement. */
  place?: Partial<Record<PlacePart, Placement>>;
}

export const DEFAULT_LOOK: CharacterLook = {
  skin: palette.base_body_defaults.skin, hair: NATURAL_HAIR,
  eyes: "F1.1", mouth: "M1.1", extras: [],
  // head-roblox: the hair is one of David's whole hairstyles (the back slot); no bangs piece exists any more
  bangs: "", back: "hair_bob_pigtail",
  top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {},
};

/**
 * Hair saved before head-roblox (David, 2026-10-14: the lock library's bangs and backs are gone): each old back, and a
 * lone old fringe, loads as the nearest of David's 21 whole hairstyles; anything else unknown loads the default.
 */
export const OLD_HAIR: Readonly<Record<string, string>> = {
  back_bob: "hair_bob_pigtail", back_bowl: "hair_bowl_cut", back_wolf: "hair_messy_wolf", back_short_spiky: "hair_anime_spikes",
  back_undercut: "hair_swept_fringe", back_long: "hair_long_scruffy", back_wavy_long: "hair_long_scruffy",
  back_high_pony: "hair_wispy_ponytail", back_bun: "hair_wispy_ponytail", back_braid_crown: "hair_hime_short",
  back_pigtails: "hair_long_pigtails", back_twin_buns: "hair_long_pigtails",
  bangs_straight: "hair_bob_pigtail", bangs_straight_long: "hair_hime_short", bangs_bowl: "hair_bowl_cut", bangs_wispy: "hair_windy_bob",
  bangs_swept_l: "hair_swept_fringe", bangs_swept_r: "hair_swept_fringe", bangs_curtain: "hair_windy_bob",
  bangs_curtain_long: "hair_long_scruffy", bangs_centre_split: "hair_layered_shag", bangs_spiky: "hair_anime_spikes",
  bangs_hime: "hair_hime_short", bangs_choppy: "hair_messy_boy", bangs_swept_back: "hair_waves", bangs_single_strand: "hair_vkei",
  bangs_wavy: "hair_messy_boy", bangs_asym_block: "hair_hime_short",
  // round 3 (David, 2026-10-17): #14, the messy low pony, removed
  hair_messy_low_pony: "hair_wispy_ponytail",
};
/** The whole hairstyle a saved look's hair loads as: its own if it still exists, else its old back's (or lone old fringe's) match. */
function hairOf(r: Record<string, unknown>): string {
  if (inSlot(r.back, "back")) return r.back;
  const old = (typeof r.back === "string" && OLD_HAIR[r.back]) || (typeof r.bangs === "string" && OLD_HAIR[r.bangs]);
  return old && inSlot(old, "back") ? old : DEFAULT_LOOK.back;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
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
    skin: index(r.skin, PALETTE.skin.length, d.skin), hair: r.hair === NATURAL_HAIR ? NATURAL_HAIR : index(r.hair, PALETTE.hair.length, d.hair),
    // A saved look's `brows` (and its brows placement) is dropped: eyebrows were removed.
    eyes: faceItem("eyes", r.eyes, d.eyes), mouth: faceItem("mouth", r.mouth, d.mouth),
    extras: Array.isArray(r.extras) ? [...new Set(r.extras.filter((e): e is string => typeof e === "string" && e in FACE.layers.extras.items))] : [],
    bangs: inSlot(r.bangs, "bangs") ? r.bangs : d.bangs, back: hairOf(r),
    top: onepiece ? null : inSlot(r.top, "top") ? r.top : d.top,
    bottom: onepiece ? null : inSlot(r.bottom, "bottom") ? r.bottom : d.bottom,
    onepiece, shoes: r.shoes === null ? null : inSlot(r.shoes, "shoes") ? r.shoes : d.shoes, acc, colors,
  };
  if (Number.isInteger(r.hairAccent) && (r.hairAccent as number) >= 0 && (r.hairAccent as number) < PALETTE.hair.length) look.hairAccent = r.hairAccent as number;
  if (typeof r.hairColor === "string" && HEX.test(r.hairColor)) look.hairColor = r.hairColor.toUpperCase();
  if (hood(look)) delete look.acc.head; // a hood and a hat never stack
  const place = parsePlace(r.place);
  if (place) look.place = place;
  // The multiplayer card carries the look only up to LOOK_MAX_BYTES: remembered colours of parts not worn go first.
  if (lookBytes(look) > LOOK_MAX_BYTES) {
    const worn = new Set(wornParts(look).map(p => p.id));
    look.colors = Object.fromEntries(Object.entries(look.colors).filter(([id]) => worn.has(id)));
  }
  return look;
}

const step = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-PLACE_STEPS, Math.min(PLACE_STEPS, Math.round(v))) : null);
/** Placement as whole steps in range; parts at rest (or malformed) are left out, and so is an empty placement. */
function parsePlace(raw: unknown): CharacterLook["place"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: CharacterLook["place"] = {};
  for (const part of Object.keys(PLACE_PARTS) as PlacePart[]) {
    const v = (raw as Record<string, unknown>)[part];
    if (!Array.isArray(v) || v.length !== 4) continue;
    const steps = v.map(step);
    if (steps.some(x => x === null)) continue;
    const p = steps as Placement;
    if (!PLACE_PARTS[part].apart) p[1] = 0;
    if (p.some(x => x !== 0)) out[part] = p.map(x => x + 0) as Placement; // + 0: no -0 in the saved JSON
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A look's size as the multiplayer card measures it (realtime_player_card: octet_length of the jsonb as text, which
 * puts a space after every comma and colon between values).
 */
export function lookBytes(look: CharacterLook): number {
  const json = JSON.stringify(look);
  let n = new TextEncoder().encode(json).length, inString = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; }
    else if (c === '"') inString = true;
    else if (c === "," || c === ":") n++;
  }
  return n;
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
  // bangs go with a two-piece back: picking them over a full hairstyle brings the default back (head fit)
  if (slot === "bangs" && id && PART_BY_ID.get(next.back)?.full) next.back = DEFAULT_LOOK.back;
  return next;
}

/** Every part a look wears, in draw order. */
export function wornParts(look: CharacterLook): CatalogPart[] {
  const ids = [look.bangs, look.back, look.onepiece ?? look.top, look.onepiece ? null : look.bottom, look.shoes, ...Object.values(look.acc)];
  // An event costume comes off when its tradition ends (it stays in the saved look for next year).
  let parts = ids.filter((id): id is string => !!id && eventPartOpen(id)).map(id => PART_BY_ID.get(id)!).filter(Boolean);
  // A full hairstyle (head fit) is the whole hair: no bangs with it.
  if (parts.some(p => p.slot === "back" && p.full)) parts = parts.filter(p => p.slot !== "bangs");
  // Hats and hoods hide the back hair (they carry their own tuck, ruling 20).
  return parts.some(p => p.hidesBackHair) ? parts.filter(p => p.slot !== "back") : parts;
}

export interface ResolvedPart { id: string; url: string; /** Its LOD 1 GLB. */ lod: string; /** Its LOD 2 GLB (a whole hairstyle's own; else its LOD 1). */ lod2: string; tints: Record<string, string>; decal: string | null;
  /** It draws texels from the fixed-colour atlas (COLOUR_ATLAS_URL). */
  colour: boolean;
  /** A mapped hairstyle: its texture's shift for each recolour channel (hairColour.ts; identity: drawn as it is). */
  map: { a: HairShift; b: HairShift } | null }
/** The colour a look picks for its hair (sRGB hex): the colour wheel's, else the palette colour; null: the style's own. */
export const hairHex = (look: CharacterLook): string | null => look.hairColor ?? PALETTE.hair[look.hair] ?? null;
/** A hairstyle without a texture worn in its own colours (NATURAL_HAIR): the palette's default hair colour. */
const PLAIN_HAIR = PALETTE.hair[palette.ref_girl_defaults.hair];
/** A hairstyle's own colour (sRGB hex): its texture's median, or PLAIN_HAIR. */
export const naturalHex = (part: CatalogPart | undefined, channel: "a" | "b" = "a") => {
  const m = part?.map?.natural[channel];
  return m ? oklabToHex(oklchToOklab(m)) : PLAIN_HAIR;
};
/** The second colour of a two-tone hairstyle on a look: the look's pick, else the style's own (its texture's, the skin). */
export function hairAccentHex(look: CharacterLook, part: CatalogPart): string | undefined {
  if (!part.map?.natural.b && !part.accent) return undefined;
  const d = part.accent?.default;
  if (typeof d === "string" && d.startsWith("#")) return d;         // fixed: a visor's logo
  if (look.hairAccent !== undefined) return PALETTE.hair[look.hairAccent];
  if (part.map?.natural.b) return naturalHex(part, "b");
  return d === "skin" ? PALETTE.skin[look.skin] : PALETTE.hair[d as number];
}
/** A mapped hairstyle's shift on a look for each channel: the picked colour's, identity for its own. */
function hairShifts(look: CharacterLook, part: CatalogPart): { a: HairShift; b: HairShift } {
  const { a, b } = part.map!.natural, hex = hairHex(look);
  return { a: a && hex ? hairShift(a, hex) : NO_SHIFT, b: b && look.hairAccent !== undefined ? hairShift(b, PALETTE.hair[look.hairAccent]) : NO_SHIFT };
}
/** Parts with their GLB URL and one sRGB hex per tinted material; decal materials without art are dropped. */
export function resolveParts(look: CharacterLook): ResolvedPart[] {
  return wornParts(look).map(part => {
    const tints: Record<string, string> = {};
    let decal: string | null = null;
    let first = true;
    for (const m of part.materials) {
      if (m.decal) { if (m.default) decal = TSI_DECAL_URL; continue; }
      // a mapped hairstyle's under-cap (u < 0, no texture) takes its texture's median, shifted as the texture is
      if (m.tint === "hair") tints[m.name] = part.map?.natural.a ? shiftedMedian(part.map.natural.a, hairShifts(look, part).a) : hairHex(look) ?? PLAIN_HAIR;
      else if (m.tint === "outfit") {
        tints[m.name] = PALETTE.outfit[first && part.id in look.colors ? look.colors[part.id] : (m.default as number)];
        first = false;
      } else if (m.color) tints[m.name] = m.color;
    }
    const map = part.map ? hairShifts(look, part) : null;
    return { id: part.id, url: CHARACTER_ROOT + part.glb, lod: LOD_ROOT + part.glb, lod2: (part.full ? LOD2_ROOT : LOD_ROOT) + part.glb, tints, decal, map, colour: !!part.colourAtlas };
  });
}

/** The editable colour of a part: its first outfit-tinted material. */
export function partColor(look: CharacterLook, id: string): number | null {
  const m = PART_BY_ID.get(id)?.materials.find(x => x.tint === "outfit");
  return m ? look.colors[id] ?? (m.default as number) : null;
}

/** Cache key for the merged body mesh (face and pose excluded). */
export const bodyKey = (look: CharacterLook) => JSON.stringify([look.skin, look.hair, resolveParts(look).map(p => [p.id, p.tints, p.decal, p.map ?? null])]);

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

// ── Event costumes (the traditions calendar, lib/content/traditions.ts) ─────
let EVENTS_OPEN: ReadonlySet<string> = new Set();
/** The traditions whose costume closets are open now (lib/game/useTraditions.ts sets it from the world clock). */
export function setEventsOpen(events: ReadonlySet<string>): void { EVENTS_OPEN = events; }
/** Shown, worn and drawn: every part, except an event costume outside its tradition. */
export function eventPartOpen(id: string, open: ReadonlySet<string> = EVENTS_OPEN): boolean {
  const event = PART_BY_ID.get(id)?.event;
  return !event || open.has(event);
}
/** The event costumes free to wear now: the wardrobe counts them as owned, the server lets a look wear them. */
export const openEventParts = (open: ReadonlySet<string> = EVENTS_OPEN): string[] => PARTS.filter(p => p.event && open.has(p.event)).map(p => p.id);

// ── Ownership (coordinator ruling on audit item 22) ─────────────────────────
/** Identity is free: skin, face, every hair style and the first six hair colours. The other six are shop dyes. */
export const FREE_HAIR_COLOURS = 6;
/** Clothes every account starts with, granted once through the inventory (20260926180000_ownership.sql; the rain-cape
 * left with David's wardrobe cut). */
export const STARTER_PARTS: readonly string[] = ["top_tee", "top_hoodie", "top_stripe_ls", "bottom_shorts", "bottom_trousers", "bottom_joggers", "shoes_slipon", "shoes_sneakers"];
/** Inventory `catalogue_ref` of a hair dye. */
export const dyeRef = (hair: number) => `hair:${hair}`;
/** Wardrobe batch 2's modes and prices (specs/wardrobe/batch2-pricing.json, David's picks, final 2026-10-15). */
export interface Batch2Price { mode: "free" | "coins" | "gems" | "skip"; price: number | null }
export const BATCH2_PRICES = batch2Pricing.items as Record<string, Batch2Price>;
/** A batch-2 item's mode and price by its key ("hair-22", "acc-01", "face-20"); null for anything else. */
export const priceOf = (key: string | undefined): Batch2Price | null => (key ? BATCH2_PRICES[key] ?? null : null);
const sold = (key: string | undefined) => { const m = priceOf(key)?.mode; return m === "coins" || m === "gems"; };
/**
 * Inventory ref that unlocks a part (a variant counts as its base part); null for free hair styles and face items.
 * Wardrobe batch 2 (David's prices): a priced hairstyle or accessory is owned like clothes; a free one is offered to
 * everyone in the starting creator, like the identity parts.
 */
export function partRef(id: string): string | null {
  const p = PART_BY_ID.get(id);
  if (!p) return null;
  if (p.grantedBy) return partRef(p.grantedBy);           // row 314: #22's hat comes with the hair
  if (p.key) return sold(p.key) ? p.variantOf ?? p.id : null;   // batch 3: a keyed item David hasn't priced yet is free until he does
  return p.slot === "bangs" || p.slot === "back" ? null : p.variantOf ?? p.id;
}
/** Inventory ref of a whole face (wardrobe batch 2): the shop row's catalogue_ref. */
export const faceRef = (faceId: string) => `face:${faceId}`;
/** Each face part (eyes, mouth, accent) of a priced whole face -> that face's ref ("a whole face that's priced gates its parts"). */
const FACE_PART_REF: ReadonlyMap<string, string> = new Map(Object.entries(FACE.faces ?? {}).filter(([key]) => sold(key))
  .flatMap(([, f]) => [f.eyes, f.mouth, ...f.extras].filter((id): id is string => !!id).map((id): [string, string] => [id, faceRef(f.id)])));
/** The ref that unlocks a face part: its whole face's when that face is priced; null for every free face part. */
export const facePartRef = (id: string): string | null => FACE_PART_REF.get(id) ?? null;
/** The ref that unlocks any creator option: a part's (partRef) or a face part's (facePartRef). */
export const unlockRef = (id: string): string | null => partRef(id) ?? facePartRef(id);
/**
 * The colour wheel (head-v10): a custom hair colour. David, 2026-10-17: a one-time 250-Gem unlock, its own shop row
 * (lib/wallet/catalogue.ts COLOUR_WHEEL_ITEM), in place of "owning any dye unlocks it" (2026-10-14); the dyes stay
 * preset colours. Free when true (one switch).
 */
export const CUSTOM_HAIR_FREE = false;
/** The colour wheel's shop row's catalogue_ref: what a look with a custom hair colour needs (lookRefs, ownsRef). */
export const CUSTOM_HAIR_REF = "colour-wheel";
/** Inventory refs owned: a set, or the server's counts by ref. */
type Owned = { has(ref: string): boolean };
/** Whether the colour wheel is open to a member owning `owned` (inventory refs): the wheel bought, never a dye. */
export const customHairUnlocked = (owned: Owned) => CUSTOM_HAIR_FREE || owned.has(CUSTOM_HAIR_REF);
/** Whether `owned` covers a ref lookRefs asks for (CUSTOM_HAIR_REF: the wheel). */
export const ownsRef = (owned: Owned, ref: string) => (ref === CUSTOM_HAIR_REF ? customHairUnlocked(owned) : owned.has(ref));
/** Every inventory ref a look needs: worn clothes, a priced hairstyle (wardrobe batch 2), a priced face's parts, a dyed
 * hair colour, and the colour wheel for a custom one (ownsRef). */
export function lookRefs(look: CharacterLook): string[] {
  const refs = [...new Set([look.top, look.bottom, look.onepiece, look.shoes, look.back, ...Object.values(look.acc)].flatMap(id => (id && partRef(id)) || [])
    .concat([look.eyes, look.mouth, ...look.extras].flatMap(id => facePartRef(id) ?? [])))];
  const dyes = [look.hair, ...(look.hairAccent !== undefined ? [look.hairAccent] : [])].filter(i => i >= FREE_HAIR_COLOURS);
  return [...refs, ...[...new Set(dyes)].map(dyeRef), ...(look.hairColor && !CUSTOM_HAIR_FREE ? [CUSTOM_HAIR_REF] : [])];
}

/**
 * Creator "surprise me" and the skip default (row 142): a complete random look.
 * With `owned`, only owned clothes and free hair colours (a new account's creator).
 */
export function randomLook(rand: () => number = Math.random, owned?: ReadonlySet<string>): CharacterLook {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  // wardrobe batch 2 (p.key) stays a creator and shop pick: residents and bots keep the looks they had
  const ids = (slot: PartSlot) => partsIn(slot).filter(p => !p.variantOf && !p.key && !p.grantedBy && (!owned || !partRef(p.id) || owned.has(p.id))).map(p => p.id);
  let look: CharacterLook = {
    ...DEFAULT_LOOK,
    skin: Math.floor(rand() * PALETTE.skin.length), hair: Math.floor(rand() * (owned ? FREE_HAIR_COLOURS : PALETTE.hair.length)),
    // sheet-coded styles only (F eyes, M mouths, what the wardrobe cut kept of them): later sets stay creator picks
    eyes: pick(Object.keys(FACE.layers.eyes.items).filter(e => /^[EF]\d/.test(e))), mouth: pick(Object.keys(FACE.layers.mouth.items).filter(m => m.startsWith("M"))),
    extras: rand() < 0.3 ? ["blush"] : [], bangs: "", back: pick(ids("back")), shoes: pick(ids("shoes")), acc: {}, colors: {},
  };
  look = rand() < 0.2 && ids("onepiece").length ? wear(look, "onepiece", pick(ids("onepiece"))) : wear(wear(look, "top", pick(ids("top"))), "bottom", pick(ids("bottom")));
  for (const id of [look.top, look.bottom, look.onepiece]) if (id && rand() < 0.6) look.colors[id] = Math.floor(rand() * PALETTE.outfit.length);
  if (rand() < 0.45 && ids("accessory").length) look = wear(look, "accessory", pick(ids("accessory")));
  return look;
}
