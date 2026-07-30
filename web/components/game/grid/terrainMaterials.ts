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
import { getGrassTexture } from "@/lib/game/grassTexture";
import { GRASS_COLOR } from "@/lib/game/grid";
import {
  applyWaterShader,
  waterUniforms,
  writeWaterUniforms,
  SHORE_FROM_FIELD,
  type WaterParams,
} from "@/lib/game/waterShader";
import { TUNING_DEFAULTS } from "@/lib/game/tuning";

const TEX_DIR = "/assets/acnh/terrain/";

/**
 * ACNH texture names -> the file that actually carries their colour.
 *
 * TWO OF THESE ARE NOT WHAT THEIR NAMES SUGGEST, and both were caught by
 * looking at the pixels rather than trusting the filename:
 *
 *   mGrass_Grd.png is NOT a tileable grass texture. "Grd" is GRADIENT — it is
 *   a 64x96 grid of flat colour swatches, a seasonal ramp that ACNH samples
 *   ONE cell of to pick the current grass colour. Tiling it across the ground
 *   painted the entire palette over the island as hard horizontal stripes.
 *   Grass therefore uses the project's existing procedural triangle-quilt
 *   texture, which is already tuned and genuinely tileable.
 *
 *   mRiver_Alb.png is the sandy RIVERBED, mean RGB (164,107,63) — orange, not
 *   blue. ACNH draws the water surface with a shader; this is what lies under
 *   it. Using it as the water surface made the river read as a dirt track.
 *
 * mCliff_Alb (512x512 rock) and the *Xlu grass fringes are what they claim.
 */
const TEXTURE_FOR: Record<string, string> = {
  mCliff: "mCliff_Alb.png",
  // The four road surfaces GridTerrain used to paint as flat hex constants.
  // NOTE the directory: these live in road/, not terrain/. And note the file
  // names -- every road material also ships a `_Grd`, and every one of those is
  // a 32x48 or 64x48 SWATCH RAMP, not an albedo. Tiling one paints the whole
  // seasonal palette on as stripes, which is what mGrass_Grd did to the lawn.
  // scripts/extract-road-textures.mjs rejects anything under 80px for exactly
  // that reason.
  mRoadSoil: "mRoadSoil_Alb.png",
  mRoadStone: "mRoadStone_Alb.png",
  mRoadWood: "mRoadWood_Alb.png",
  mRoadBrick: "mRoadBrick_Alb.png",
  // NOT the _AlbGry files. ACNH splits these into _AlbGry (greyscale colour,
  // tinted at runtime) and _OP (the blade shapes). The _AlbGry alone has NO
  // usable alpha -- measured 0% opaque -- so with alphaTest 0.4 every fragment
  // was discarded and the card was invisible. scripts/extract-grass-fringe.mjs
  // composites the pair into one RGBA file with these names.
  mGrassCliffXlu: "mGrassCliffXlu.png",
  mGrassRiverXlu: "mGrassRiverXlu.png",
  mRiverBed: "mRiverBed_Alb.png",
  mSand: "mSand_Alb.png",
};

/** Detail normals, where the kit ships one we can use. */
const NORMAL_FOR: Record<string, string> = {
  mRoadSoil: "mRoadSoil_Nrm.png",
  mRoadStone: "mRoadStone_Nrm.png",
  mRoadWood: "mRoadWood_Nrm.png",
  mRoadBrick: "mRoadBrick_Nrm.png",
};

/** Names we handle without an ACNH file. */
const PROCEDURAL = new Set(["mGrass", "mProcGrass", "mRiver"]);

/**
 * `_AlbGry` files are GREYSCALE on purpose — ACNH tints them at runtime, which
 * is how the whole game does seasons without a second texture set. The grass
 * fringe draped over a cliff lip is one of them, so it needs a tint or it
 * renders as a grey smear.
 */
const TINT_FOR: Record<string, number> = {
  mGrassCliffXlu: GRASS_COLOR,
  mGrassRiverXlu: GRASS_COLOR,
};

/** Materials that are alpha-cut foliage cards, not solid surfaces. */
const ALPHA_MATERIALS = new Set(["mGrassCliffXlu", "mGrassRiverXlu", "mProcGrass"]);

let cache: Map<string, THREE.Material> | null = null;
let grassNrm: THREE.Texture | null = null;

/**
 * `mGrass_Nrm.png` — the detail that makes ACNH ground look like ground.
 *
 * Its blue channel is zeroed (mean 128,128,0), which is a two-channel normal
 * map: Z is meant to be reconstructed. Three's standard material does not do
 * that, so the raw texture would flatten the lighting instead of adding to it.
 * `normalScale` therefore starts at 0 and `applyGrassNormalStrength` drives it,
 * which also makes it a single number the bench can move.
 */
function grassNormal(): THREE.Texture {
  if (grassNrm) return grassNrm;
  const t = new THREE.TextureLoader().load(TEX_DIR + "mGrass_Nrm.png");
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  grassNrm = t;
  return t;
}

/**
 * Push the bench's normal-map settings onto the shared grass material.
 * Called from the render tree so a slider move shows up without a remount.
 */
export function applyGrassNormalStrength(strength: number, worldUnitsPerRepeat: number): void {
  const mat = cache?.get("mGrass") as THREE.MeshStandardMaterial | undefined;
  if (!mat || !mat.normalMap) return;
  mat.normalScale.set(strength, strength);
  // The ground's UVs are already world-continuous at UV_CELLS_PER_REPEAT, so
  // this repeat is relative to that, not to the tile.
  const r = Math.max(0.01, 2 / worldUnitsPerRepeat);
  mat.normalMap.repeat.set(r, r);
  mat.normalMap.needsUpdate = true;
}

const ROAD_DIR = "/assets/acnh/road/";

/** Road materials ship in road/, the rest in terrain/. */
function dirFor(name: string): string {
  return name.startsWith("mRoad") ? ROAD_DIR : TEX_DIR;
}

function loadTexture(loader: THREE.TextureLoader, file: string, dir = TEX_DIR): THREE.Texture {
  const t = loader.load(dir + file);
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
/**
 * Longest key wins.
 *
 * A plain `includes` scan in declaration order is a trap here, because ACNH
 * material names nest: "mGrassCliffXlu".includes("mGrass") is TRUE. The grass
 * fringe therefore matched the procedural grass key first and rendered as a
 * SOLID opaque quad instead of an alpha-cut card — a pale collar wrapped
 * around every cliff top. Sorting by length puts the specific name first.
 */
const MATCH_KEYS = [...Object.keys(TEXTURE_FOR), ...PROCEDURAL].sort((a, b) => b.length - a.length);

function matchKey(name: string): string | null {
  return MATCH_KEYS.find((k) => name.includes(k)) ?? null;
}

export function terrainMaterial(name: string): THREE.Material | null {
  if (!cache) cache = new Map();

  const key0 = matchKey(name);
  if (!key0) return null;

  // The ACNH file for grass is a colour ramp, not a texture, so grass and the
  // proc-grass tufts use the project's own triangle-quilt instead.
  const procKey = PROCEDURAL.has(key0) ? key0 : null;
  if (procKey) {
    const hit = cache.get(procKey);
    if (hit) return hit;
    const isWater = procKey === "mRiver";
    if (isWater) {
      const mat = waterMaterial();
      cache.set(procKey, mat);
      return mat;
    }
    const mat = new THREE.MeshStandardMaterial({
      map: isWater ? undefined : getGrassTexture(),
      // ACNH's grass has NO albedo texture — the colour comes from the ramp.
      // What gives its ground blade detail is `mGrass_Nrm`, a 256x256 tangent
      // normal map we were not using at all, which is why the lawn read as one
      // flat green. Strength is on the bench (`tuning.grass.normalStrength`).
      normalMap: isWater ? undefined : grassNormal(),
      normalScale: isWater ? undefined : new THREE.Vector2(0, 0),
      color: isWater ? 0x568cb2 : GRASS_COLOR,
      roughness: isWater ? 0.4 : 0.92,
      metalness: 0,
      transparent: isWater,
      opacity: isWater ? 0.85 : 1,
    });
    mat.name = `terrain:${procKey}`;
    cache.set(procKey, mat);
    return mat;
  }

  const key = key0;
  const hit = cache.get(key);
  if (hit) return hit;

  const loader = new THREE.TextureLoader();
  const isAlpha = ALPHA_MATERIALS.has(key);
  const dir = dirFor(key);
  /**
   * Road surfaces get their detail normal too, and it is safe to bind because
   * the extractor already reconstructed Z. The source files are TWO-CHANNEL
   * (blue flat zero, Z implied), and three's standard material does not
   * reconstruct -- binding a raw one flattens the lighting instead of adding to
   * it, which is how mGrass_Nrm rendered the whole ground black.
   */
  const nrm = NORMAL_FOR[key]
    ? loadTexture(loader, NORMAL_FOR[key], dir)
    : undefined;
  const mat = new THREE.MeshStandardMaterial({
    map: loadTexture(loader, TEXTURE_FOR[key], dir),
    normalMap: nrm,
    normalScale: nrm ? new THREE.Vector2(0.5, 0.5) : undefined,
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

/**
 * The river surface.
 *
 * Was a MeshStandardMaterial with a scrolling `mRiver_Nrm`. That normal map is
 * real and the flow trick worked, but a LIT material cannot produce the flat
 * saturated cyan David's references are made of: ambient + hemi + env IBL land
 * on top of everything the shader does and grey it out. The whole look now
 * lives in `lib/game/waterShader.ts`, on an unlit MeshBasicMaterial, shared
 * with the sea.
 */
function waterMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mat.name = "terrain:mRiver";
  applyWaterShader(mat, () => waterUniformBlock, { shore: SHORE_FROM_FIELD });
  return mat;
}

/**
 * Live handles on the water shader. Held here rather than rebuilt per frame:
 * the material is shared and cached, so a bench move must write through to the
 * uniform objects the compiled shader already holds.
 */
const waterUniformBlock = {
  ...waterUniforms(TUNING_DEFAULTS.water),
  uShoreMap: { value: null as THREE.Texture | null },
  /** World rect the field covers: (minX, minZ, sizeX, sizeZ). */
  uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
};

/**
 * Hand the water shader its distance field.
 *
 * Half-float so the waterline stays exactly where `shoreSdf` put it — an 8-bit
 * texture would quantise the crossing and contour the foam edge. R16F is core
 * WebGL2 and linearly filterable without an extension.
 */
export function setShoreField(f: {
  data: Float32Array;
  width: number;
  height: number;
  minX: number;
  minZ: number;
  sizeX: number;
  sizeZ: number;
}): void {
  const half = new Uint16Array(f.data.length);
  for (let i = 0; i < f.data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(f.data[i]);
  const tex = new THREE.DataTexture(half, f.width, f.height, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // Clamp, not repeat: sampling past the map edge must read the last shoreline
  // value, not wrap round to the far side of the island.
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  waterUniformBlock.uShoreMap.value?.dispose();
  waterUniformBlock.uShoreMap.value = tex;
  waterUniformBlock.uShoreRect.value.set(f.minX, f.minZ, f.sizeX, f.sizeZ);
}

/**
 * Apply the bench's water settings and advance the clock. Called once per frame
 * from GridWorld, and from the bench.
 *
 * `sunWorld` is the scene's key-light direction. It stays in WORLD space now —
 * the old shader converted it to view space on the CPU to save a per-fragment
 * reconstruction, but `cameraPosition` is a built-in uniform, so the fragment
 * shader can build the view vector itself and the conversion bought nothing.
 */
export function advanceWater(elapsed: number, cfg: WaterParams, sunWorld?: THREE.Vector3): void {
  waterUniformBlock.uTime.value = elapsed;
  writeWaterUniforms(waterUniformBlock, cfg);
  if (sunWorld) waterUniformBlock.uSunDir.value.copy(sunWorld).normalize();
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
