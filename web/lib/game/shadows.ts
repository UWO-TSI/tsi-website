/**
 * One shadow logic for every asset (specs/look-development.md §9, row 240).
 *
 * Every model gets one class from its URL, and every mesh one role from its
 * class and material name. prepareModel applies it; SunShadows (High) and
 * ContactShadows (both tiers) read what it set. No call site opts out.
 *
 * | Class   | Sun shadow (High)       | Contact      | Receives        |
 * | solid   | casts                   | footprint    | yes             |
 * | foliage | clean caster only       | footprint    | trunks, not leaf cards |
 * | small   | no                      | small        | yes             |
 * | none    | no                      | no           | as before       |
 */
export type ShadowClass = "solid" | "foliage" | "small" | "none";

/** Flat or airborne: rugs and mats lie on the floor, critters fly or perch, background pieces are scenery. */
const NONE = /\/(critters|fish)\/|\/props\/(distant-view|waterfall|balloon)|\/furniture\/[\w-]*(rug|mat)\.glb$/;
/** Below what a sun shadow reads at the follow camera: flowers, shells, pebbles, tufts, pickups. */
const SMALL = /\/plants\/flower-|\/props\/(shell-|grass-tuft-|crab-)|\/nature\/(grass-tufts|rock_small|mushroom_)|\/furniture\/lounge-(book|tea)\.glb$|\/game\/props\/(branch|message-bottle)\.glb$/;
/** Solid, but spanning water or floating: nothing under it is ground. */
const NO_CONTACT = /\/props\/(bridge-|boat|buoy)/;

export function shadowClassFor(url: string): ShadowClass {
  if (NONE.test(url)) return "none";
  if (SMALL.test(url)) return "small";
  return url.includes("/plants/") ? "foliage" : "solid";
}

/** ACNH's tree shadow casters (extract-acnh-kit keeps them): mShadow is the closed hull, mShadowShake the canopy cards that sway. */
export const CASTER_MATERIAL = /^mShadow(Shake)?$/;
/** A plant's trunk. ACNH names it; the old export's cedar calls it mat1. */
const TRUNK = /Trunk|Stump|PltTreeCedar4_mat1$/;

export interface MeshShadow {
  cast: boolean;
  receive: boolean;
  /** Cast from the light-facing faces only, so a leaf clump's shadow is its outline, not both walls of every card. */
  front?: boolean;
  /** A caster-only mesh: never drawn in colour. "sway" moves with the canopy wind, so it casts every frame. */
  caster?: "static" | "sway";
}

/**
 * One mesh's role. `casters`: the model carries ACNH's own casters, so its
 * visible foliage casts nothing. `glass`: a transparent shell (lamp globe),
 * which casts nothing and receives as it always did.
 */
export function meshShadow(cls: ShadowClass, material: string, { casters = false, glass = false } = {}): MeshShadow {
  if (CASTER_MATERIAL.test(material)) return { cast: true, receive: false, caster: material === "mShadowShake" ? "sway" : "static" };
  if (glass || cls === "small" || cls === "none") return { cast: false, receive: true };
  if (cls === "solid" || TRUNK.test(material)) return { cast: cls === "solid" || !casters, receive: true };
  // Leaf cards never receive: layered cards shadowing each other is the blotching this replaces.
  return casters ? { cast: false, receive: false } : { cast: true, receive: false, front: true };
}

/** A contact shadow in the object's own frame: footprint centre, half extents, height, and how dark (small things are faint). */
export interface ContactSize { cx: number; cz: number; rx: number; rz: number; height: number; strength: number }

/**
 * The soft darkening under a grounded object, from its local bounds: the
 * footprint plus a feathered margin; small things get a tighter disc and no
 * height (they never stretch toward the sun on Light).
 */
export function contactSize(url: string, cls: ShadowClass, box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }): ContactSize | null {
  if (cls === "none" || NO_CONTACT.test(url) || box.max.x < box.min.x) return null;
  const small = cls === "small", grow = small ? 0.75 : 1.1, margin = small ? 0.04 : 0.12;
  return {
    cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2,
    rx: ((box.max.x - box.min.x) / 2) * grow + margin, rz: ((box.max.z - box.min.z) / 2) * grow + margin,
    height: small ? 0 : Math.max(0, box.max.y), strength: small ? 0.45 : 1,
  };
}

/** A ground ellipse: centre, half extents along its own x and z, and yaw (three's rotation.y). */
export interface Ellipse { x: number; z: number; rx: number; rz: number; yaw: number }

/** Casters at least this tall get a sun-directed shadow on Light. */
const TALL = 1;
/** The Light tier's directed shadow flattens below this sun elevation instead of running across the island. */
const MIN_ELEVATION = (15 * Math.PI) / 180;
/** And never runs longer than this many times the caster's height. */
const MAX_STRETCH = 3;

/** Half extent of an ellipse along the unit ground direction (ux, uz). */
function support(e: Ellipse, ux: number, uz: number): number {
  const lx = ux * Math.cos(e.yaw) - uz * Math.sin(e.yaw), lz = ux * Math.sin(e.yaw) + uz * Math.cos(e.yaw);
  return Math.hypot(e.rx * lx, e.rz * lz);
}

/**
 * The Light tier's cheap sun shadow (no shadow map): a soft ellipse from the
 * footprint away from the sun, as long as the caster's shadow on flat ground
 * (height / tan elevation, bounded), as wide as the footprint across the sun.
 * `sun` points toward the sun (the key light's position minus its target).
 * Written into `out` (the frame loop passes a scratch ellipse).
 */
export function sunShadow(footprint: Ellipse, height: number, sun: readonly [number, number, number], out: Ellipse = { x: 0, z: 0, rx: 0, rz: 0, yaw: 0 }): Ellipse | null {
  const flat = Math.hypot(sun[0], sun[2]);
  if (height < TALL || flat < 1e-6 || sun[1] <= 0) return null;
  const ux = -sun[0] / flat, uz = -sun[2] / flat;
  const elevation = Math.max(Math.atan2(sun[1], flat), MIN_ELEVATION);
  const length = Math.min(height / Math.tan(elevation), height * MAX_STRETCH);
  out.x = footprint.x + ux * length / 2; out.z = footprint.z + uz * length / 2;
  out.rx = support(footprint, uz, -ux); out.rz = length / 2 + support(footprint, ux, uz);
  out.yaw = Math.atan2(ux, uz);
  return out;
}
