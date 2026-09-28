import { Color, DoubleSide, FrontSide, Material, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, Object3D, SRGBColorSpace, Texture, TextureLoader, Vector2, type WebGLProgramParametersWithUniforms } from "three";
import { CASTER_MATERIAL, meshShadow, shadowClassFor, type ShadowClass } from "./shadows";

let flagTexture: Texture | null = null;
let shopSignTexture: Texture | null = null;

/** HQ glass is a separate mesh from the masonry and window frames. */
export function lightHQWindows(model: Object3D, color: string): void {
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial) || !/^m(?:Window[LR]|SideWindow)$/.test(material.name)) continue;
      material.map = null;
      material.emissiveMap = null;
      material.color.set(color);
      material.emissive.set(color);
      material.roughness = 1;
      material.needsUpdate = true;
    }
  });
}
function getShopSignTexture() {
  if (!shopSignTexture) {
    shopSignTexture = new TextureLoader().load("/assets/branding/shop-sign-v1.png");
    shopSignTexture.colorSpace = SRGBColorSpace;
    shopSignTexture.flipY = false;
  }
  return shopSignTexture;
}
function getFlagTexture() {
  if (!flagTexture) {
    flagTexture = new TextureLoader().load("/assets/branding/island-flag.svg");
    flagTexture.colorSpace = SRGBColorSpace;
    flagTexture.flipY = false;
  }
  return flagTexture;
}

/**
 * Oak foliage tint (greyscale leaf albedo x tint, as in ACNH). Shared by every
 * live oak leaf material so the season can retint trees without remounting.
 */
const LEAF_GAIN = 1.6;
const leafTint = new Color("#9bc87e");
const leafMaterials = new Set<MeshStandardMaterial>();
export function setLeafTint(hex: string): void {
  if (leafTint.equals(new Color(hex))) return;
  leafTint.set(hex);
  for (const material of leafMaterials) material.color.copy(leafTint).multiplyScalar(LEAF_GAIN);
}

/**
 * Tree wind sway (decision 145, High tier). x = time, y = sway amplitude in
 * world units at the crown. Zero (the default) leaves trees still, so worlds
 * that never drive it are unchanged.
 */
export const TREE_WIND = { value: new Vector2(0, 0) };
function addTreeSway(shader: WebGLProgramParametersWithUniforms) {
  shader.uniforms.uTreeWind = TREE_WIND;
  shader.vertexShader = "uniform vec2 uTreeWind;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
    #include <begin_vertex>
    float swayH = clamp(position.y / 3.0, 0.0, 1.0);
    swayH *= swayH;
    vec4 swayRoot = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float swayPhase = uTreeWind.x * 1.7 + swayRoot.x * 0.37 + swayRoot.z * 0.23;
    transformed.x += sin(swayPhase) * uTreeWind.y * swayH;
    transformed.z += cos(swayPhase * 0.8) * uTreeWind.y * 0.6 * swayH;`);
}

/** The shadow pass of ACNH's swaying canopy caster (mShadowShake): the leaves' own wind, so shadow and canopy move together. */
const SWAY_DEPTH = new MeshDepthMaterial();
SWAY_DEPTH.onBeforeCompile = addTreeSway;
SWAY_DEPTH.customProgramCacheKey = () => "tree-sway-depth";

/**
 * Winter snow caps (0..1): a top-down snow blend on outdoor props and
 * buildings — roofs, bridge deck, benches, fences, lamp tops — wherever the
 * world-space normal faces up. Plants are excluded (they swap to the dump's
 * snow variants instead). Zero leaves every model unchanged.
 */
export const WORLD_SNOW = { value: 0 };
function addSnowCap(shader: WebGLProgramParametersWithUniforms) {
  shader.uniforms.uWorldSnow = WORLD_SNOW;
  shader.vertexShader = "varying float vSnowUp;\n" + shader.vertexShader.replace("#include <beginnormal_vertex>", `
    #include <beginnormal_vertex>
    vSnowUp = normalize(mat3(modelMatrix) * objectNormal).y;`);
  shader.fragmentShader = "uniform float uWorldSnow;\nvarying float vSnowUp;\n" + shader.fragmentShader.replace("#include <map_fragment>", `
    #include <map_fragment>
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), uWorldSnow * smoothstep(0.45, 0.8, vSnowUp));`);
}

const GLASS = /^(m(Window\w*|SideWindow|RoofWindow|Glass\w*|Mirror)|M_Glass)$/;
const METAL = /^M_(Blade|Brass|Steel|Iron|Drum)$/;
/** Painted-metal atlases: the whole body is metal (LookMaterials keeps light paint, e.g. a clock face, dielectric). */
const METAL_BODY = /\/(props\/streetlamp|props\/park-clock|furniture\/mailbox)\.glb:m(ReBody|Body)$/;

/**
 * Look class of a GLB material (lookPreset.ts, LookMaterials). Glass and metal
 * (row 237) are named materials on outdoor props, buildings and weapons.
 * Furniture is interior dressing (interiors are deferred) except the mailbox
 * and the fitting room that stand outside; the driftwood sword is wood.
 * Characters never come through here: their materials are "Character*".
 */
export function lookClassFor(url: string, name: string): "foliage" | "props" | "glass" | "metal" {
  if (url.includes("/plants/")) return "foliage";
  const outdoor = /\/(props|buildings|weapons)\//.test(url) || /\/furniture\/(fitting-room|mailbox)\.glb$/.test(url);
  if (!outdoor || url.includes("driftwood")) return "props";
  if (GLASS.test(name)) return "glass";
  return METAL.test(name) || METAL_BODY.test(`${url}:${name}`) ? "metal" : "props";
}

/** Tag a model's (possibly cached) materials with their look class; for models that skip prepareModel (held weapons). */
export function tagLookClasses<T extends Object3D>(model: T, url: string): T {
  model.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.userData.lookClass = lookClassFor(url, m.name);
  });
  return model;
}

/**
 * Clone materials as well as nodes so one instance cannot recolor cached GLTF
 * assets. Shadows follow the model's class (lib/game/shadows.ts); `shadow`
 * overrides it only where a use differs from what the URL says.
 */
export function prepareModel(source: Object3D, url: string, emissiveIntensity?: number, shadow: ShadowClass = shadowClassFor(url)): Object3D {
  const materials = new Map<Material, Material>();
  const clone = source.clone(true);
  let casters = false;
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh && (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(m => CASTER_MATERIAL.test(m.name))) casters = true;
  });
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // The vertex shader bends distant models back into view. Their original
    // bounds cannot determine visibility in the curved world.
    mesh.frustumCulled = false;
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const glassShell = /\/props\/(streetlamp|park-clock)\.glb$/.test(url)
      && originals.every((material) => material.transparent && material.name.startsWith("mGlass"));
    const role = meshShadow(shadow, originals[0].name, { casters, glass: glassShell });
    mesh.castShadow = role.cast;
    mesh.receiveShadow = role.receive;
    if (role.caster) {
      // Depth only: hidden until SunShadows draws it into the shadow map.
      mesh.material = new MeshBasicMaterial({ name: originals[0].name, side: DoubleSide, colorWrite: false, depthWrite: false });
      mesh.visible = false;
      mesh.userData.casterOnly = true;
      if (role.caster === "sway") { mesh.userData.sunCaster = "dynamic"; mesh.customDepthMaterial = SWAY_DEPTH; }
      return;
    }
    const adapt = (original: Material) => {
      const existing = materials.get(original);
      if (existing) return existing;
      const material = original.clone();
      // Material class for the look (lookPreset.ts).
      material.userData.lookClass = lookClassFor(url, material.name);
      material.side = glassShell ? FrontSide : DoubleSide;
      if (role.front) material.shadowSide = FrontSide;
      if (glassShell) material.depthWrite = false;
      if (material instanceof MeshStandardMaterial && material.emissiveMap && emissiveIntensity !== undefined) {
        material.emissiveIntensity = emissiveIntensity;
      }
      if (url.includes("/plants/tree-hardwood-") && material instanceof MeshStandardMaterial) {
        // Grayscale foliage and trunk albedos need their seasonal colour tint.
        // Snow variants ship coloured albedo (no greyscale tint).
        if (material.name.includes("OakLeaf") && !material.name.includes("Snow")) {
          material.color.copy(leafTint).multiplyScalar(LEAF_GAIN);
          leafMaterials.add(material);
          // Compress the grayscale atlas contrast so dark leaf cards retain colour.
          // This affects albedo only; alpha cutouts and scene lighting remain intact.
          material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
              #include <map_fragment>
              #ifdef USE_MAP
                diffuseColor.rgb = diffuse * (0.065 + 0.9 * sampledDiffuseColor.rgb);
              #endif
            `);
          };
        }
        if (material.name.includes("OakTrunk")) material.color.copy(new Color("#b88c58").multiplyScalar(1.7));
      }
      if (material instanceof MeshStandardMaterial && (
        (url.endsWith("/buildings/hq-office.glb") && material.name === "mMyDesign")
        || (url.endsWith("/buildings/shop-market.glb") && material.name === "mSign")
      )) {
        material.color.set(0xffffff);
      }
      if (!url.includes("/plants/") && material instanceof MeshStandardMaterial) {
        const base = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          base.call(material, shader, renderer);
          addSnowCap(shader);
        };
        material.customProgramCacheKey = () => "snow-cap-v1";
      }
      if (/\/plants\/tree-/.test(url)) {
        const base = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          base.call(material, shader, renderer);
          addTreeSway(shader);
        };
        material.customProgramCacheKey = () => `tree-sway:${material.name}`;
      }
      materials.set(original, material);
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(adapt) : adapt(mesh.material);
  });
  return clone;
}

export function disposeModelMaterials(model: Object3D): void {
  const seen = new Set<Material>();
  model.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue;
      seen.add(material);
      if (material instanceof MeshStandardMaterial) leafMaterials.delete(material);
      material.dispose();
    }
  });
}

export function applyModelTextures(model: Object3D, url: string): void {
  const isHQ = url.endsWith("/buildings/hq-office.glb");
  const isShop = url.endsWith("/buildings/shop-market.glb");
  if (!isHQ && !isShop) return;
  const texture = isHQ ? getFlagTexture() : getShopSignTexture();
  const materialName = isHQ ? "mMyDesign" : "mSign";
  model.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material instanceof MeshStandardMaterial && material.name === materialName) {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  });
}
