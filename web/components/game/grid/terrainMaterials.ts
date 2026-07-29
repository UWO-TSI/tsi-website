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
    color: 0xffffff, // the ramp below supplies all colour
    normalMap: waterNrm,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
    // The surface sits 0.078u below its banks and is viewed from above; writing
    // depth would z-fight the riverbed once that is drawn under it.
    depthWrite: false,
  });
  mat.name = "terrain:mRiver";

  /**
   * Four things, all riding one attribute or one uniform.
   *
   * THE COLOUR RAMP. `aShore` is the signed distance from the waterline in
   * cells, baked by `shoreField()` at build time and sampled per VERTEX, so it
   * is continuous across cell boundaries — a per-cell value drew the grid on
   * screen the moment the foam became a hard edge. David's stylised reference
   * samples #F8F8F7 foam at the edge, #C9EEF4 pale just inside it, and #62DAE6
   * saturated cyan in open water — so it is a three-stop ramp on one number we
   * already have, not three separate effects.
   *
   * FOAM. Same attribute, a tighter band. This is why the reference has a white
   * collar around every rock and lily pad: it is not decoration placed per
   * object, it is what water does near anything it touches. Ours currently
   * collars the banks and the beach. Props standing IN the water will not get
   * one until props come from the map, because the map is what shore distance
   * is computed from.
   *
   * SUN GLINT. The mirrored sun, as a specular lobe about the reflected view
   * vector. The direction arrives already in VIEW space — converted once per
   * frame on the CPU rather than reconstructing world space per fragment.
   *
   * SWELL. Vertical displacement from two sine waves at different angles and
   * incommensurate frequencies, so the surface is never uniformly up or down —
   * which is the "waves that aren't uniform" ask. It is a function of WORLD
   * position, so adjacent cells agree at their shared edge and the sheet stays
   * continuous even though each cell is its own four vertices. The normal is
   * perturbed from the same function analytically, or the swell would move the
   * surface without changing how it catches light.
   */
  mat.onBeforeCompile = (shader) => {
    for (const [k, v] of Object.entries(waterUniforms)) shader.uniforms["u" + k[0].toUpperCase() + k.slice(1)] = v;

    const WAVE = `
      float uWaveK1 = 6.2831853 / max(uWaveScale, 0.001);
      vec2 uWaveD1 = normalize(vec2(1.0, 0.35));
      vec2 uWaveD2 = normalize(vec2(-0.42, 1.0));
      float wA1 = dot(position.xz, uWaveD1) * uWaveK1 + uTime * uWaveSpeed;
      float wA2 = dot(position.xz, uWaveD2) * uWaveK1 * 1.63 + uTime * uWaveSpeed * 1.31;
      float waveH = (sin(wA1) * 0.62 + sin(wA2) * 0.38) * uWaveHeight;
      vec2 waveG = uWaveD1 * (cos(wA1) * 0.62 * uWaveK1 * uWaveHeight)
                 + uWaveD2 * (cos(wA2) * 0.38 * uWaveK1 * 1.63 * uWaveHeight);`;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWorldPos;
         uniform float uTime;
         uniform float uWaveHeight;
         uniform float uWaveScale;
         uniform float uWaveSpeed;`
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
         ${WAVE}
         objectNormal = normalize(vec3(-waveG.x, 1.0, -waveG.y));`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         transformed.y += waveH;
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uDeepColor;
         uniform vec3 uShallowColor;
         uniform vec3 uFoamColor;
         uniform vec3 uSky;
         uniform vec3 uSunView;
         uniform float uDepthFalloff;
         uniform float uFoamWidth;
         uniform float uFoamStrength;
         uniform float uFresnel;
         uniform float uSunGlint;
         uniform float uSunSharp;
         uniform float uGlare;
         uniform float uGlareWidth;
         uniform float uSparkle;
         uniform float uSparkleSpeed;
         uniform float uTime;
         uniform sampler2D uShoreMap;
         uniform vec4 uShoreRect;
         varying vec3 vWorldPos;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         // Distance from the waterline in cells, read per FRAGMENT from the
         // baked field. Per-vertex would cap the detail at one cell, which is
         // the whole width of the water mesh's quads.
         vec2 shoreUv = (vWorldPos.xz - uShoreRect.xy) / uShoreRect.zw;
         float edge = max(texture2D(uShoreMap, shoreUv).r, 0.0);
         float openness = clamp(edge / max(uDepthFalloff, 0.001), 0.0, 1.0);
         vec3 waterCol = mix(uShallowColor, uDeepColor, openness);
         // SOLID collar, not a gradient (David, 2026-07-28). A hard step would
         // alias into a staircase along every curve, so the only blend is
         // exactly one pixel wide: fwidth() gives how fast edge changes
         // across this fragment, which is the width in world units of one
         // pixel here. The band therefore stays crisp when the camera is close
         // and stays smooth when it is far, instead of shimmering.
         float aa = max(fwidth(edge), 1e-5) * 0.8;
         float foam = 1.0 - smoothstep(uFoamWidth - aa, uFoamWidth + aa, edge);
         diffuseColor.rgb *= mix(waterCol, uFoamColor, foam * uFoamStrength);
         // Lift the collar clear of the lighting so it reads as one flat white
         // shape from every angle, which is what makes it a "radius" rather
         // than a shaded rim. Scaled by strength so the slider still means
         // something at the low end.
         totalEmissiveRadiance += uFoamColor * foam * uFoamStrength * 0.35;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         vec3 wN = normalize(normal);
         vec3 wV = normalize(vViewPosition);
         float rim = pow(1.0 - clamp(dot(wN, wV), 0.0, 1.0), 3.0);
         totalEmissiveRadiance += uSky * rim * uFresnel;
         // THE SUN ON THE WATER, in two lobes plus a sparkle field.
         //
         // One tight specular lobe is what we had, and it reads as a dull dot
         // because that is what it is. The reference has a BROAD blown-out
         // sheet of glare with sharp points flickering inside it, so:
         //
         //   broad  low power, wide, over-bright. This is the sheet. Pushing it
         //          past 1.0 is deliberate — it clips to white and reads as
         //          overexposure, which is the "super shiny" part.
         //   tight  high power, small. The individual flares.
         //   spark  three sines beating against each other over WORLD position
         //          and time. Their product is near zero most of the time and
         //          occasionally spikes, which is what makes the flares come
         //          and go instead of sitting there. This is the "occasionally"
         //          and it is also where the dimension comes from — the field
         //          moves independently of the surface, so the highlight
         //          crawls across it.
         //
         // Both are killed inside the foam, where a mirror highlight is wrong.
         float sd = max(dot(reflect(-wV, wN), uSunView), 0.0);
         float broad = pow(sd, max(uGlareWidth, 0.5));
         float tight = pow(sd, max(uSunSharp, 1.0));
         float t = uTime * uSparkleSpeed;
         float n = sin(vWorldPos.x * 2.7 + t * 1.7)
                 * sin(vWorldPos.z * 2.3 - t * 1.3)
                 * sin((vWorldPos.x + vWorldPos.z) * 1.7 + t * 2.3);
         float spark = mix(1.0, smoothstep(0.15, 0.85, n * 0.5 + 0.5), uSparkle);
         vec3 sunCol = vec3(1.0, 0.98, 0.92);
         totalEmissiveRadiance += sunCol * (broad * uGlare + tight * uSunGlint * spark) * (1.0 - foam);`
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
  time: { value: 0 },
  deepColor: { value: new THREE.Color(0x62dae6) },
  shallowColor: { value: new THREE.Color(0xc9eef4) },
  foamColor: { value: new THREE.Color(0xf8f8f7) },
  sky: { value: new THREE.Color(0x9fc4e8) },
  sunView: { value: new THREE.Vector3(0, 1, 0) },
  depthFalloff: { value: 2.2 },
  foamWidth: { value: 0.85 },
  foamStrength: { value: 0.9 },
  fresnel: { value: 0.25 },
  glare: { value: 1.5 },
  glareWidth: { value: 26 },
  sunGlint: { value: 6.5 },
  sunSharp: { value: 230 },
  sparkle: { value: 0.7 },
  sparkleSpeed: { value: 1.4 },
  waveHeight: { value: 0.035 },
  waveScale: { value: 7 },
  waveSpeed: { value: 0.7 },
  shoreMap: { value: null as THREE.Texture | null },
  /** World rect the field covers: (minX, minZ, sizeX, sizeZ). */
  shoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
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
  waterUniforms.shoreMap.value?.dispose();
  waterUniforms.shoreMap.value = tex;
  waterUniforms.shoreRect.value.set(f.minX, f.minZ, f.sizeX, f.sizeZ);
}

const _sun = new THREE.Vector3();

/**
 * Scroll the flow, drive the swell, and apply the bench's water settings.
 * Called once per frame from GridWorld.
 *
 * `sunWorld` is the scene's key-light direction; it is converted to VIEW space
 * here, once, so the fragment shader can do the glint with a single dot product
 * instead of reconstructing world space per pixel.
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
    deepColor: number;
    shallowColor: number;
    foamColor: number;
    foamWidth: number;
    foamStrength: number;
    sunGlint: number;
    sunSharp: number;
    glare: number;
    glareWidth: number;
    sparkle: number;
    sparkleSpeed: number;
    waveHeight: number;
    waveScale: number;
    waveSpeed: number;
  },
  sunWorld?: THREE.Vector3,
  camera?: THREE.Camera
): void {
  const u = waterUniforms;
  u.time.value = elapsed;
  u.deepColor.value.setHex(cfg.deepColor);
  u.shallowColor.value.setHex(cfg.shallowColor);
  u.foamColor.value.setHex(cfg.foamColor);
  u.depthFalloff.value = cfg.depthFalloff;
  u.foamWidth.value = cfg.foamWidth;
  u.foamStrength.value = cfg.foamStrength;
  u.fresnel.value = cfg.fresnel;
  u.sunGlint.value = cfg.sunGlint;
  u.sunSharp.value = cfg.sunSharp;
  u.glare.value = cfg.glare;
  u.glareWidth.value = cfg.glareWidth;
  u.sparkle.value = cfg.sparkle;
  u.sparkleSpeed.value = cfg.sparkleSpeed;
  u.waveHeight.value = cfg.waveHeight;
  u.waveScale.value = cfg.waveScale;
  u.waveSpeed.value = cfg.waveSpeed;

  if (sunWorld && camera) {
    _sun.copy(sunWorld).normalize().transformDirection(camera.matrixWorldInverse);
    u.sunView.value.copy(_sun);
  }

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
