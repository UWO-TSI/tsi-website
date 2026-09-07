import { Color, DoubleSide, Material, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Texture, TextureLoader } from "three";

let flagTexture: Texture | null = null;
function getFlagTexture() {
  if (!flagTexture) {
    flagTexture = new TextureLoader().load("/assets/branding/island-flag.svg");
    flagTexture.colorSpace = SRGBColorSpace;
    flagTexture.flipY = false;
  }
  return flagTexture;
}

/** Clone materials as well as nodes so one instance cannot recolor cached GLTF assets. */
export function prepareModel(source: Object3D, url: string, castShadow: boolean): Object3D {
  const materials = new Map<Material, Material>();
  const clone = source.clone(true);
  clone.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    const adapt = (original: Material) => {
      const existing = materials.get(original);
      if (existing) return existing;
      const material = original.clone();
      material.side = DoubleSide;
      if (url.includes("/plants/tree-hardwood-") && material instanceof MeshStandardMaterial) {
        // These textures are grayscale seasonal ramps; GLTF carries no tint.
        if (material.name.includes("OakLeaf")) material.color.copy(new Color("#a9c977").multiplyScalar(2));
        if (material.name.includes("OakTrunk")) material.color.copy(new Color("#b88c58").multiplyScalar(1.7));
      }
      if (url.endsWith("/buildings/hq-office.glb") && material instanceof MeshStandardMaterial && material.name === "mMyDesign") {
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
  if (!url.endsWith("/buildings/hq-office.glb")) return;
  const texture = getFlagTexture();
  model.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material instanceof MeshStandardMaterial && material.name === "mMyDesign") {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  });
}
