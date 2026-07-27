"use client";

/**
 * terrainMaterials — ONE shared material per ACNH terrain surface (M4).
 *
 * WHY NOT USE THE MATERIALS IN THE GLBs. Three reasons, all measured:
 *
 * 1. The Fld* kits carry no textures of their own. mCliff_Alb, mGrass_Grd and
 *    the rest live in the shared `FldUnit` asset — that is what FldUnit IS,
 *    the material library every Fld kit draws from. Copied once into
 *    `public/assets/acnh/terrain/` (328KB for the whole set).
 * 2. Even with the textures resolved, assimp maps a Collada diffuse COLOUR
 *    onto baseColorFactor, and these materials set diffuse to 0 and rely
 *    entirely on the texture. Every cliff face exported as `[0,0,0,0]` and
 *    rendered as a black slab.
 * 3. `mGrass` has no base-colour texture bound at all in the source; its
 *    colour comes from `mGrass_Grd.png`, which the exporter never connects.
 *
 * Assigning by MATERIAL NAME sidesteps all three, and it is the same move the
 * systems doc argued for: the renderer's draw count is bound by distinct
 * materials, so collapsing 44 cliff pieces onto one shared set is what makes a
 * texture atlas possible later. Right now it is one material per surface;
 * atlasing merges those into one, at which point a chunk becomes a single draw.
 */

import * as THREE from "three";

const TEX_DIR = "/assets/acnh/terrain/";

/** ACNH texture names -> the file that actually carries their colour. */
const TEXTURE_FOR: Record<string, string> = {
  mCliff: "mCliff_Alb.png",
  mGrass: "mGrass_Grd.png",
  mGrassCliffXlu: "mGrassCliffXlu_AlbGry.png",
  mGrassRiverXlu: "mGrassRiverXlu_AlbGry.png",
  mRiver: "mRiver_Alb.png",
  mRiverBed: "mRiverBed_Alb.png",
  mSand: "mSand_Alb.png",
};

/**
 * `_AlbGry` files are GREYSCALE on purpose — ACNH tints them at runtime, which
 * is how the whole game does seasons without a second texture set. The grass
 * fringe draped over a cliff lip is one of them, so it needs a tint or it
 * renders as a grey smear.
 */
const TINT_FOR: Record<string, number> = {
  mGrassCliffXlu: 0x7cae56,
  mGrassRiverXlu: 0x7cae56,
};

/** Materials that are alpha-cut foliage cards, not solid surfaces. */
const ALPHA_MATERIALS = new Set(["mGrassCliffXlu", "mGrassRiverXlu", "mProcGrass"]);

let cache: Map<string, THREE.Material> | null = null;

function loadTexture(loader: THREE.TextureLoader, file: string): THREE.Texture {
  const t = loader.load(TEX_DIR + file);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  // ACNH source textures are tiny (32x48 up to 512x512). Nearest keeps them
  // crisp instead of smearing them, which matches the pixelated render target.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/**
 * Shared material for an ACNH material name, or null when we have no override
 * and the GLB's own material should stand.
 */
export function terrainMaterial(name: string): THREE.Material | null {
  if (!cache) cache = new Map();
  const key = Object.keys(TEXTURE_FOR).find((k) => name.includes(k));
  if (!key) return null;

  const hit = cache.get(key);
  if (hit) return hit;

  const loader = new THREE.TextureLoader();
  const isAlpha = ALPHA_MATERIALS.has(key);
  const mat = new THREE.MeshStandardMaterial({
    map: loadTexture(loader, TEXTURE_FOR[key]),
    color: TINT_FOR[key] ?? 0xffffff,
    roughness: 0.92,
    metalness: 0,
    // Foliage cards are visible from both sides and must not write depth as
    // solid geometry, or they punch holes in what is behind them.
    side: isAlpha ? THREE.DoubleSide : THREE.FrontSide,
    transparent: isAlpha,
    alphaTest: isAlpha ? 0.4 : 0,
  });
  mat.name = `terrain:${key}`;
  cache.set(key, mat);
  return mat;
}

/** Swap a loaded kit piece onto the shared materials, in place. */
export function applyTerrainMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const current = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const shared = terrainMaterial(current?.name ?? mesh.name ?? "");
    if (shared) mesh.material = shared;
  });
}
