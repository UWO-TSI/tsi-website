import { Color, DoubleSide, FrontSide, Material, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Texture, TextureLoader } from "three";

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

/** Clone materials as well as nodes so one instance cannot recolor cached GLTF assets. */
export function prepareModel(source: Object3D, url: string, castShadow: boolean, emissiveIntensity?: number): Object3D {
  const materials = new Map<Material, Material>();
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // The vertex shader bends distant models back into view. Their original
    // bounds cannot determine visibility in the curved world.
    mesh.frustumCulled = false;
    mesh.castShadow = castShadow;
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const glassShell = /\/props\/(streetlamp|park-clock)\.glb$/.test(url)
      && originals.every((material) => material.transparent && material.name.startsWith("mGlass"));
    if (glassShell) mesh.castShadow = false;
    const layeredCanopy = /\/plants\/tree-(hardwood-|blossom)/.test(url)
      && originals.every((material) => /OakLeaf|SakuraBack|SakuraBloom/.test(material.name));
    // Layered foliage cards self-shadow into hard patches. Keep their light
    // response and ground shadow without shadowing one card onto the next.
    mesh.receiveShadow = !layeredCanopy;
    const adapt = (original: Material) => {
      const existing = materials.get(original);
      if (existing) return existing;
      const material = original.clone();
      material.side = glassShell ? FrontSide : DoubleSide;
      if (glassShell) material.depthWrite = false;
      if (material instanceof MeshStandardMaterial && material.emissiveMap && emissiveIntensity !== undefined) {
        material.emissiveIntensity = emissiveIntensity;
      }
      if (url.includes("/plants/tree-hardwood-") && material instanceof MeshStandardMaterial) {
        // Grayscale foliage and trunk albedos need their seasonal colour tint.
        if (material.name.includes("OakLeaf")) {
          material.color.copy(new Color("#9bc87e").multiplyScalar(1.6));
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
