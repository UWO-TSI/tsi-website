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
  mGrassCliffXlu: "mGrassCliffXlu_AlbGry.png",
  mGrassRiverXlu: "mGrassRiverXlu_AlbGry.png",
  mRiverBed: "mRiverBed_Alb.png",
  mSand: "mSand_Alb.png",
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
  mGrassCliffXlu: 0x7cae56,
  mGrassRiverXlu: 0x7cae56,
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
      color: isWater ? 0x568cb2 : 0x7cae56,
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

let waterNrm: THREE.Texture | null = null;

/**
 * The river surface.
 *
 * NOT `mRiver_Alb`. That file is the sandy RIVERBED — mean RGB (164,107,63),
 * orange — which is what lies UNDER the water, and using it as the surface made
 * the river read as a dirt track. ACNH draws the surface with a shader, and the
 * asset that carries it is `mRiver_Nrm`: a 512x128 normal map whose wide aspect
 * IS the flow direction.
 *
 * So the water is a tinted, glossy, semi-transparent surface with that normal
 * map SCROLLING along the flow. That is the whole trick, it needs no albedo
 * fetch, and the animation is one texture-offset write per frame rather than
 * anything per-vertex.
 *
 * (The map was two-channel like the grass one — blue flat zero, Z implied.
 * `scripts/fix-normal-maps.mjs` reconstructed it, or this would render black
 * the same way the lawn did.)
 */
function waterMaterial(): THREE.MeshStandardMaterial {
  if (!waterNrm) {
    const t = new THREE.TextureLoader().load(TEX_DIR + "mRiver_Nrm.png");
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    waterNrm = t;
  }
  const mat = new THREE.MeshStandardMaterial({
    // Deep-water colour. MEASURED off David's ACNH reference, not picked: the
    // channel centre samples #26415E and the bank rim #6F8496. The previous
    // #4F87A8 was both far too light and far too cyan, which is most of why the
    // river read as painted-on.
    color: 0x26415e,
    normalMap: waterNrm,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
    // The surface sits 0.078u below its banks and is viewed from above; writing
    // depth would z-fight the riverbed once that is drawn under it.
    depthWrite: false,
  });
  mat.name = "terrain:mRiver";

  /**
   * Two things the reference has that a flat tinted plane cannot.
   *
   * 1. A DEPTH GRADIENT. ACNH water is dark navy mid-channel and lightens
   *    sharply at the bank. `aShore` carries the exact distance in cells,
   *    baked by `shoreDistance()` at build time, so this is a lookup rather
   *    than an approximation.
   *
   * 2. A SKY SHEEN. The reference reads near-mirror — you can see the bank and
   *    the standing villager reflected in it. Real reflections are a second
   *    render pass we are not paying for; a Fresnel term that brightens toward
   *    grazing angles gets most of that read for free, because the grazing
   *    angles are exactly where a reflection would dominate.
   *
   * Both go through `onBeforeCompile` on a stock MeshStandardMaterial, so the
   * water still takes the scene's lights, fog and shadows normally.
   */
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShallow = waterUniforms.shallow;
    shader.uniforms.uSky = waterUniforms.sky;
    shader.uniforms.uDepthFalloff = waterUniforms.depthFalloff;
    shader.uniforms.uFresnel = waterUniforms.fresnel;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute float aShore;
         varying float vShore;`
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vShore = aShore;");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uShallow;
         uniform vec3 uSky;
         uniform float uDepthFalloff;
         uniform float uFresnel;
         varying float vShore;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         // 1 at the bank, 0 once we are uDepthFalloff cells out.
         float shallow = 1.0 - clamp((vShore - 1.0) / max(uDepthFalloff, 0.001), 0.0, 1.0);
         diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, shallow * shallow);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
         totalEmissiveRadiance += uSky * rim * uFresnel;`
      );
  };
  return mat;
}

/**
 * Live handles on the water shader. Held here rather than rebuilt per frame:
 * the material is shared and cached, so a bench move must write through to the
 * uniform objects the compiled shader already holds.
 */
const waterUniforms = {
  shallow: { value: new THREE.Color(0x6f8496) },
  sky: { value: new THREE.Color(0x9fc4e8) },
  depthFalloff: { value: 2.5 },
  fresnel: { value: 0.35 },
};

/**
 * Scroll the flow and apply the bench's water settings. Called once per frame
 * from GridWorld — a texture-offset write, not a shader recompile.
 */
export function advanceWater(
  elapsed: number,
  cfg: {
    flowSpeed: number;
    flowScale: number;
    ripple: number;
    opacity: number;
    roughness: number;
    depthFalloff: number;
    fresnel: number;
  }
): void {
  waterUniforms.depthFalloff.value = cfg.depthFalloff;
  waterUniforms.fresnel.value = cfg.fresnel;
  const mat = cache?.get("mRiver") as THREE.MeshStandardMaterial | undefined;
  if (!mat || !mat.normalMap) return;
  const r = Math.max(0.01, 2 / cfg.flowScale);
  mat.normalMap.repeat.set(r, r);
  // Flow runs along the map's long axis; the cross-axis drift at a different
  // rate keeps it from reading as a conveyor belt.
  mat.normalMap.offset.set(elapsed * cfg.flowSpeed, elapsed * cfg.flowSpeed * 0.31);
  mat.normalScale.set(cfg.ripple, cfg.ripple);
  mat.opacity = cfg.opacity;
  mat.roughness = cfg.roughness;
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
