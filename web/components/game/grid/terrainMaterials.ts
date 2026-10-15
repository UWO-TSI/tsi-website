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
import { addCutout } from "@/lib/game/occluders";
import { addCliffStone } from "@/lib/game/cliffStone";
import { getGrassTexture } from "@/lib/game/grassTexture";
import { GRASS_COLOR, WATER_DROP } from "@/lib/game/grid";
import { FOAM_RING_MAX, GLASS_WATER, SHORE_FROM_FIELD, SWELL_TUNING, UNDERWATER, UNDERWATER_UNIFORMS, WATER_DEPTH_RAMP, WATER_RIPPLE, bedDepth, waterMaterial, waterUniforms, writeWaterUniforms, type SeaKind, type WaterParams } from "@/lib/game/waterShader";
import { foamRings } from "@/lib/game/foamRings";
import { TUNING_DEFAULTS } from "@/lib/game/tuning";
import { WAVE_LITE, WAVE_MAX, advanceWaves } from "@/lib/game/waves";
import { mirrorWaterField, mirroredDepth, type FieldGrid } from "@/lib/game/waterField";
import { bakeWaveCalm } from "@/lib/game/seabed";
import type { ShoreSdf } from "@/lib/game/grid";

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
  // Our own seabed sand (art/water/build_seabed.py, v1 water item 2): ripple marks seen through the shallows.
  mRiverBed: "seabed-sand.webp",
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
  mRoadSoil: 0xba9664,
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
 * The grass material reconstructs positive Z before applying normalScale.
 * The bench controls the resulting detail strength.
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
}

const ROAD_DIR = "/assets/acnh/road/";

/** Road materials ship in road/, the seabed's sand in game/water/, the rest in terrain/. */
function dirFor(name: string): string {
  return name.startsWith("mRoad") ? ROAD_DIR : name === "mRiverBed" ? "/assets/game/water/" : TEX_DIR;
}

function loadTexture(loader: THREE.TextureLoader, file: string, dir = TEX_DIR, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture {
  const t = loader.load(dir + file);
  t.colorSpace = colorSpace;
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

/**
 * The water's material for a sea (lib/game/waterShader.ts SeaKind): the waves' is the shared "mRiver" one; main's swell,
 * for every world that doesn't opt in to the waves (the applicant island first), its own, cached beside it.
 */
export function waterSurfaceMaterial(sea: SeaKind): THREE.Material {
  if (sea === "waves") return terrainMaterial("mRiver")!;
  if (!cache) cache = new Map();
  let mat = cache.get("mRiver:swell");
  if (!mat) {
    mat = waterMaterial(waterUniformBlock, "swell");
    mat.name = "terrain:mRiver:swell";
    cache.set("mRiver:swell", mat);
  }
  return mat;
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
    if (procKey === "mRiver") {
      // Unlit, from lib/game/waterShader.ts: a lit material greys out the flat saturated cyan of David's references.
      const mat = waterMaterial(waterUniformBlock);
      mat.name = "terrain:mRiver";
      cache.set(procKey, mat);
      return mat;
    }
    const mat = new THREE.MeshStandardMaterial({
      map: getGrassTexture(),
      // ACNH's grass has NO albedo texture — the colour comes from the ramp.
      // What gives its ground blade detail is `mGrass_Nrm`, a 256x256 tangent
      // normal map we were not using at all, which is why the lawn read as one
      // flat green. Strength is on the bench (`tuning.grass.normalStrength`).
      normalMap: grassNormal(),
      normalScale: new THREE.Vector2(0, 0),
      color: GRASS_COLOR,
      roughness: 0.92,
      metalness: 0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>",
        THREE.ShaderChunk.normal_fragment_maps.replace("mapN.xy *= normalScale;",
          "mapN.z = sqrt(max(0.0, 1.0 - dot(mapN.xy, mapN.xy)));\nmapN.xy *= normalScale;"));
    };
    mat.customProgramCacheKey = () => "terrain-grass-normal-rg-v1";
    mat.name = `terrain:${procKey}`;
    cache.set(procKey, withCutout(mat));
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
    ? loadTexture(loader, NORMAL_FOR[key], dir, THREE.NoColorSpace)
    : undefined;
  const mat = new THREE.MeshStandardMaterial({
    map: loadTexture(loader, TEXTURE_FOR[key], dir),
    ...(nrm ? { normalMap: nrm, normalScale: new THREE.Vector2(0.5, 0.5) } : {}),
    color: TINT_FOR[key] ?? 0xffffff,
    roughness: 0.92,
    metalness: 0,
    // Foliage cards are visible from both sides and must not write depth as
    // solid geometry, or they punch holes in what is behind them.
    side: isAlpha ? THREE.DoubleSide : THREE.FrontSide,
    transparent: isAlpha,
    depthWrite: !isAlpha,
    alphaTest: isAlpha ? 0.4 : 0,
  });
  if (isAlpha) {
    // The exported fringe contains a valid blade mask but zero RGB. Use its
    // alpha with the terrain tint instead of multiplying the grass by black.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>",
        THREE.ShaderChunk.map_fragment.replace("diffuseColor *= sampledDiffuseColor;", "diffuseColor.a *= sampledDiffuseColor.a;"));
    };
    mat.customProgramCacheKey = () => "terrain-fringe-alpha-v1";
  }
  if (key === "mCliff") {
    // The walls as faceted stone, not the kit's painted strata (v1 land pass, lib/game/cliffStone.ts).
    mat.onBeforeCompile = (shader) => addCliffStone(shader);
    mat.customProgramCacheKey = () => "terrain-cliff-stone-v1";
  }
  if (key === "mRiverBed") {
    // One repeat of the sand per four cells (the ground's UVs repeat every two).
    mat.map!.repeat.setScalar(0.5);
    seenThroughWater(mat);
  }
  mat.name = `terrain:${key}`;
  cache.set(key, withCutout(mat));
  return mat;
}

/**
 * The seabed is seen through the water over it (v1 water item 1): its lit colour fogs toward the water's own depth
 * ramp by the depth the water field bakes for that point (the bed lies exactly at that depth), so sand under a hand
 * of water is sand, and it goes teal and then blue as the bed drops away. One texture read, no extra pass.
 */
function seenThroughWater(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => addUnderwater(shader, "field");
  mat.customProgramCacheKey = () => "seabed-underwater-v2";
}
/** Glass water (v1 water item 5): 1 draws the refraction wobble under the surface, 0 none (Lite, or the toggle off). */
export const GLASS_ON = { value: 0 };
/** The bed's texture repeats every four world units (the ground's UVs every two, the sand's repeat 0.5): world to uv. */
const BED_UV_PER_UNIT = 0.25;

/**
 * Patch a lit built-in material so what it draws is seen through the water over it (UNDERWATER): the bed itself
 * (`field`: it lies at the depth the field bakes) or something standing in the sea (`sea`: its depth under the sea's
 * still surface, level 0), instanced or not. Shares the water's live uniforms, so the fog follows the phase and weather.
 */
export function addUnderwater(shader: THREE.WebGLProgramParametersWithUniforms, depth: "field" | "sea") {
  const u = waterUniformBlock as Record<string, THREE.IUniform>;
  Object.assign(shader.uniforms, {
    uShoreMap: u.uShoreMap, uShoreRect: u.uShoreRect, uDepthFalloff: u.uDepthFalloff, uUnderwaterFog: UNDERWATER_FOG,
    uBedColor: u.uBedColor, uShallowColor: u.uShallowColor, uMidColor: u.uMidColor, uDeepColor: u.uDeepColor, uNavyColor: u.uNavyColor,
    uTime: u.uTime, uRippleTexture: u.uRippleTexture, uRippleStrength: u.uRippleStrength, uGlass: GLASS_ON,
  });
  const glass = "uniform float uTime;\n" + WATER_RIPPLE + GLASS_WATER;
  // Glass water: a prop standing in the sea shifts its own vertices by the surface's refraction where they are (its
  // instance's turn and scale undone, so neighbours wobble together).
  const wobble = depth === "sea" ? `
    #ifdef USE_INSTANCING
      vec3 glassAt = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      vec2 glassBy = glassShift(glassAt.xz, max(${(-WATER_DROP).toFixed(4)} - glassAt.y, 0.0));
      transformed += inverse(mat3(instanceMatrix)) * vec3(glassBy.x, 0.0, glassBy.y);
    #endif
    #include <project_vertex>` : "#include <project_vertex>";
  shader.vertexShader = "varying vec3 vSeaWorld;\n" + (depth === "sea" ? glass : "") + shader.vertexShader.replace("#include <project_vertex>", `${wobble}
    #ifdef USE_INSTANCING
      vSeaWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`);
  const at = depth === "field" ? "waterDepthAt(vSeaWorld.xz)" : `max(${(-WATER_DROP).toFixed(4)} - vSeaWorld.y, 0.0)`;
  shader.fragmentShader = "varying vec3 vSeaWorld;\n" + UNDERWATER_UNIFORMS + SHORE_FROM_FIELD + WATER_DEPTH_RAMP + UNDERWATER + (depth === "field" ? glass : "") + shader.fragmentShader
    .replace("#include <opaque_fragment>", `outgoingLight = underwater(outgoingLight, ${at});
    #include <opaque_fragment>`);
  // Glass water on the bed: its sand looked up where the moving surface bends the view to.
  if (depth === "field") shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D(map, vMapUv + glassShift(vSeaWorld.xz, waterDepthAt(vSeaWorld.xz)) * ${BED_UV_PER_UNIT.toFixed(2)});
      diffuseColor *= sampledDiffuseColor;
    #endif`);
}
/** How strongly what lies under the water fogs toward the water's colour by its depth (0 off). Shared: the bed, the seabed props, the fish. */
export const UNDERWATER_FOG = { value: 0.85 };

/**
 * The terrain fades round the player where a hill or a cliff stands between them and the orbit camera
 * (lib/game/occluders.ts): the shared material and everything that calls its onBeforeCompile draw the cut.
 */
function withCutout(mat: THREE.Material): THREE.Material {
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => { before.call(mat, shader, renderer); addCutout(shader); };
  mat.customProgramCacheKey = () => `${key}|cut`;
  return mat;
}

/**
 * Live handles on the water shader. Held here rather than rebuilt per frame:
 * the material is shared and cached, so a bench move must write through to the
 * uniform objects the compiled shader already holds.
 */
const waterUniformBlock = {
  ...waterUniforms(TUNING_DEFAULTS.water),
  uRippleTexture: { value: null as THREE.Texture | null },
  uRippleStrength: { value: 0 },
  uShoreMap: { value: null as THREE.Texture | null },
  /** World rect the field covers: (minX, minZ, sizeX, sizeZ). */
  uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  /** The waves' calm (lib/game/seabed.ts bakeWaveCalm), a unit a texel, and the world rect it covers. */
  uCalmMap: { value: null as THREE.Texture | null },
  uCalmRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  uCloudMap: { value: null as THREE.Texture | null },
  uCloudUv: { value: new THREE.Vector4() },
  uCloudShade: { value: 0 },
  /** The foam rings drawn this frame (x, z, radius, strength each; lib/game/foamRings.ts), and how many. */
  uFoamRings: { value: new Float32Array(FOAM_RING_MAX * 4) },
  uFoamRingCount: { value: 0 },
};

const _eye = new THREE.Vector3(), _dir = new THREE.Vector3();
/**
 * Hand the water the foam rings nearest the view's focus (where its ray meets the sea), at most `slots` (Lite fewer).
 * Called once per frame from GridWorld; `on` false (the world bench's switch) draws none.
 */
export function drawFoamRings(camera: THREE.Camera, slots: number, on = true): void {
  if (!on) { waterUniformBlock.uFoamRingCount.value = 0; return; }
  camera.getWorldPosition(_eye);
  camera.getWorldDirection(_dir);
  const t = _dir.y < -0.05 ? Math.min(-_eye.y / _dir.y, 60) : 60;
  waterUniformBlock.uFoamRingCount.value = foamRings.nearest(_eye.x + _dir.x * t, _eye.z + _dir.z * t, Math.min(slots, FOAM_RING_MAX), waterUniformBlock.uFoamRings.value, 70);
}

/**
 * The cloud layer CloudShadows draws (its texture and world-to-uv transform),
 * so the sun's glare and sparkles dim where a cloud shadow passes; null while
 * none is drawn. Called once per frame from GridWorld.
 */
export function shadeWaterByClouds(map: THREE.Texture | null, uv: THREE.Vector4): void {
  waterUniformBlock.uCloudMap.value = map;
  waterUniformBlock.uCloudUv.value.copy(uv);
  waterUniformBlock.uCloudShade.value = map ? 1 : 0;
}

/**
 * Hand the water shader its field: the distance to the shore and the seabed's depth.
 *
 * Half-float so the waterline stays exactly where `shoreSdf` put it — an 8-bit
 * texture would quantise the crossing and contour the foam edge. RG16F is core
 * WebGL2 and linearly filterable without an extension.
 */
export function setShoreField(f: {
  data: Float32Array;
  /** The seabed's depth at each sample (lib/game/seabed.ts bakeWaterDepth); without it, the profile of the distance alone. */
  depth?: Float32Array;
  /** The waves' calm (lib/game/seabed.ts bakeWaveCalm, with the map's berths); without it, the open sea and the rivers alone. */
  calm?: FieldGrid;
  width: number;
  height: number;
  minX: number;
  minZ: number;
  sizeX: number;
  sizeZ: number;
}): void {
  // Two channels: red the distance to the shore, green how deep the seabed lies (the water's colour and the waves read it).
  const half = new Uint16Array(f.data.length * 2), depth = new Float32Array(f.data.length);
  for (let i = 0; i < f.data.length; i++) {
    half[i * 2] = THREE.DataUtils.toHalfFloat(f.data[i]);
    half[i * 2 + 1] = THREE.DataUtils.toHalfFloat(f.depth ? f.depth[i] : f.data[i] > 0 ? bedDepth(f.data[i], TUNING_DEFAULTS.water) : 0);
    // The CPU's copy as the GPU holds it (half floats), for what floats on the waves (lib/game/waterField.ts).
    depth[i] = THREE.DataUtils.fromHalfFloat(half[i * 2 + 1]);
  }
  const calm = f.calm ?? bakeWaveCalm({ ...f, scale: f.width / f.sizeX } as ShoreSdf);
  setCalmField(calm);
  mirrorWaterField({ data: depth, width: f.width, height: f.height, minX: f.minX, minZ: f.minZ, sizeX: f.sizeX, sizeZ: f.sizeZ }, calmMirror);
  const tex = new THREE.DataTexture(half, f.width, f.height, THREE.RGFormat, THREE.HalfFloatType);
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

/** The waves' calm as an 8-bit texture (it is smooth and 0..1), and the CPU's copy of what the GPU reads from it. */
let calmMirror: FieldGrid | null = null;
function setCalmField(c: FieldGrid): void {
  const bytes = new Uint8Array(c.data.length), seen = new Float32Array(c.data.length);
  for (let i = 0; i < c.data.length; i++) { bytes[i] = Math.round(Math.min(1, Math.max(0, c.data[i])) * 255); seen[i] = bytes[i] / 255; }
  const tex = new THREE.DataTexture(bytes, c.width, c.height, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  waterUniformBlock.uCalmMap.value?.dispose();
  waterUniformBlock.uCalmMap.value = tex;
  waterUniformBlock.uCalmRect.value.set(c.minX, c.minZ, c.sizeX, c.sizeZ);
  calmMirror = { ...c, data: seen };
}

/**
 * After an edit (the world editor, specs/world-editor.md): rewrite rows j0..j1 of the field already up (the same size
 * as `f`) and upload it again, rather than building a new texture. False when there is none of that size. The waves'
 * calm keeps what it was baked with (a brush stroke rarely opens a river to the sea).
 */
export function patchShoreField(f: { data: Float32Array; depth: Float32Array; width: number; height: number }, j0: number, j1: number): boolean {
  const tex = waterUniformBlock.uShoreMap.value as THREE.DataTexture | null;
  if (!tex || tex.image.width !== f.width || tex.image.height !== f.height) return false;
  const half = tex.image.data as Uint16Array, mirror = mirroredDepth();
  for (let j = Math.max(0, j0); j <= Math.min(f.height - 1, j1); j++) for (let i = 0; i < f.width; i++) {
    const k = j * f.width + i;
    half[k * 2] = THREE.DataUtils.toHalfFloat(f.data[k]);
    half[k * 2 + 1] = THREE.DataUtils.toHalfFloat(f.depth[k]);
    if (mirror && mirror.data.length === f.data.length) mirror.data[k] = THREE.DataUtils.fromHalfFloat(half[k * 2 + 1]);
  }
  tex.needsUpdate = true;
  return true;
}

/**
 * Apply the bench's water settings and advance the clock. Called once per frame
 * from GridWorld, and from the bench.
 *
 * `sunWorld` is the scene's key-light direction (sun by day, moon by night), in
 * WORLD space and used as is: the water mirrors the real light, and each
 * viewer's own camera decides what reaches their eye (row 238). `sunColor`
 * tints it (a warm white by day, gold at golden hour). `sky`: the scene's sky overhead and at the horizon, which the
 * water mirrors (fresnel) and hazes into far off. `lite`: Lite's fewer wave trains (lib/game/waves.ts WAVE_LITE).
 * `sea`: the world's sea (waterShader.ts SeaKind); main's swell runs on main's tuning (SWELL_TUNING) and no wave table.
 */
export function advanceWater(elapsed: number, cfg: WaterParams, sunWorld?: THREE.Vector3, sunColor?: THREE.Color, sky?: { zenith: THREE.Color; horizon: THREE.Color }, lite = false, sea: SeaKind = "waves"): void {
  seaNow = sea;
  if (sea === "waves") {
    // The waves' table this frame, from the world clock: the CPU's (liveWaves, what floats reads) and the shader's, the same numbers.
    const waves = advanceWaves(cfg, elapsed, lite ? WAVE_LITE : WAVE_MAX);
    const a = waterUniformBlock.uWaveA.value, b = waterUniformBlock.uWaveB.value, tb = waves.table;
    for (let i = 0; i < WAVE_MAX; i++) { a[i].fromArray(tb, i * 8); b[i].fromArray(tb, i * 8 + 4); }
    waterUniformBlock.uWaveCount.value = waves.count;
  } else waterUniformBlock.uWaveCount.value = 0;
  waterUniformBlock.uRippleStrength.value = cfg.rippleStrength ?? 0;
  if (cfg.rippleStrength && !waterUniformBlock.uRippleTexture.value) {
    waterUniformBlock.uRippleTexture.value = loadTexture(new THREE.TextureLoader(), "mSeaWater_Nrm.png", TEX_DIR, THREE.NoColorSpace);
    waterUniformBlock.uRippleTexture.value.magFilter = THREE.LinearFilter;
  }
  waterUniformBlock.uTime.value = elapsed;
  // cfg changes with phase, weather or season; the bench hands a fresh copy per frame.
  if (cfg !== written || sea !== writtenSea) {
    writeWaterUniforms(waterUniformBlock, sea === "swell" ? { ...cfg, ...SWELL_TUNING } : cfg);
    written = cfg;
    writtenSea = sea;
  }
  if (sunWorld) waterUniformBlock.uSunDir.value.copy(sunWorld).normalize();
  if (sunColor) waterUniformBlock.uSunColor.value.copy(sunColor).lerp(WHITE, 0.2);
  // The sky the water mirrors and hazes into (v1 water item 4): the scene's own, per phase and weather.
  if (sky) { waterUniformBlock.uSkyZenith.value.copy(sky.zenith); waterUniformBlock.uSkyHorizon.value.copy(sky.horizon); }
}
const WHITE = new THREE.Color(1, 1, 1);
let written: WaterParams | null = null;
let writtenSea: SeaKind = "waves";
/** The sea the water was last advanced as (advanceWater, every frame): what rides it picks its shader by it (moveFx). */
let seaNow: SeaKind = "waves";
export const activeSea = (): SeaKind => seaNow;

/** The live water uniforms, for layers that ride the same surface and sun (the glint sprites). */
export const waterSurfaceUniforms = (): Record<string, THREE.IUniform> => waterUniformBlock;
