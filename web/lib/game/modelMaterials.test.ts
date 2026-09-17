import { expect, it, vi } from "vitest";
import { BoxGeometry, FrontSide, Frustum, Group, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Texture, Vector3 } from "three";
import { disposeModelMaterials, lightHQWindows, prepareModel } from "./modelMaterials";
import { bendViewPoint } from "./worldProjection";

it("lights only instance-owned HQ glass while preserving frames and cached textures", () => {
  const texture = new Texture();
  const glass = new MeshStandardMaterial({ name: "mWindowL", map: texture, emissiveMap: texture });
  const wall = new MeshStandardMaterial({ name: "mWall", map: texture, emissiveMap: texture });
  const source = new Mesh(new BoxGeometry(), [glass, wall]);
  const clone = prepareModel(source, "/assets/acnh/buildings/hq-office-village.glb", true) as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  lightHQWindows(clone, "#ffc95a");
  expect(clone.material[0].map).toBeNull();
  expect(clone.material[0].emissiveMap).toBeNull();
  expect(clone.material[0].emissive.getHexString()).toBe("ffc95a");
  expect(clone.material[1].map).toBe(texture);
  expect(clone.material[1].emissiveMap).toBe(texture);
  expect(glass.map).toBe(texture);
  expect(glass.emissive.getHex()).toBe(0);
  disposeModelMaterials(clone);
  source.geometry.dispose(); glass.dispose(); wall.dispose(); texture.dispose();
});

it("keeps source materials intact and disposes only the instance's shared clones", () => {
  const texture = new Texture();
  const material = new MeshStandardMaterial({ name: "mTreeOakLeaf", map: texture });
  const geometry = new BoxGeometry();
  const source = new Group();
  source.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  const originalDispose = vi.spyOn(material, "dispose");
  const geometryDispose = vi.spyOn(geometry, "dispose");
  const textureDispose = vi.spyOn(texture, "dispose");
  const clone = prepareModel(source, "/assets/acnh/plants/tree-hardwood-a.glb", true);
  const first = clone.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>;
  const second = clone.children[1] as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  expect(first.material).not.toBe(material);
  expect(second.material).toEqual([first.material, first.material]);
  expect(first.material.map).toBe(texture);
  expect(material.color.getHex()).toBe(0xffffff);
  expect(first.material.color.g).toBeGreaterThan(first.material.color.r);
  const cloneDispose = vi.spyOn(first.material, "dispose");
  disposeModelMaterials(clone);
  expect(cloneDispose).toHaveBeenCalledOnce();
  expect(originalDispose).not.toHaveBeenCalled();
  expect(geometryDispose).not.toHaveBeenCalled();
  expect(textureDispose).not.toHaveBeenCalled();
});

it("keeps a curved-world model visible when its unbent bounds are above the view", () => {
  const camera = new PerspectiveCamera(48, 2, 0.1, 300);
  camera.position.set(0, 19.5, -35);
  camera.lookAt(0, 1.5, -15);
  camera.updateMatrixWorld();
  const source = new Mesh(new BoxGeometry(6.76, 3.89, 3.42), new MeshStandardMaterial());
  source.position.set(0, 5, 30);
  source.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  expect(frustum.intersectsObject(source)).toBe(false);
  const drawn = bendViewPoint(new Vector3(0, 5, 30).applyMatrix4(camera.matrixWorldInverse)).applyMatrix4(camera.projectionMatrix);
  expect(Math.abs(drawn.y)).toBeLessThan(1);
  const prepared = prepareModel(source, "/assets/acnh/buildings/oracle-museum.glb", true);
  expect(prepared.frustumCulled).toBe(false);
  expect(source.frustumCulled).toBe(true);
  disposeModelMaterials(prepared);
  source.material.dispose();
  source.geometry.dispose();
});

it("changes mapped lamp glow per instance without lighting glass or mutating the cache", () => {
  const body = new MeshStandardMaterial({ emissive: "white", emissiveMap: new Texture() });
  const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.4 });
  const source = new Mesh(new BoxGeometry(), [body, glass]);
  const day = prepareModel(source, "/assets/acnh/props/streetlamp.glb", true, 0) as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  const night = prepareModel(source, "/assets/acnh/props/streetlamp.glb", true, 2.2) as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  expect(day.material[0].emissiveIntensity).toBe(0);
  expect(night.material[0].emissiveIntensity).toBe(2.2);
  expect(body.emissiveIntensity).toBe(1);
  expect(night.material[1].emissiveIntensity).toBe(1);
  expect(night.material[1].opacity).toBe(0.4);
  disposeModelMaterials(day);
  expect(night.material[0].emissiveMap).toBe(body.emissiveMap);
  disposeModelMaterials(night);
  body.emissiveMap?.dispose();
  body.dispose();
  glass.dispose();
  source.geometry.dispose();
});


it("keeps repaired glass transparent and out of the opaque shadow pass", () => {
  for (const prop of ["streetlamp", "park-clock"]) {
    const glass = new MeshStandardMaterial({ name: "mGlassF", transparent: true, opacity: 0.4 });
    const source = new Mesh(new BoxGeometry(), glass);
    const clone = prepareModel(source, `/assets/acnh/props/${prop}.glb`, true) as Mesh<BoxGeometry, MeshStandardMaterial>;
    expect(clone.castShadow).toBe(false);
    expect(clone.material.side).toBe(FrontSide);
    expect(clone.material.depthWrite).toBe(false);
    expect(glass.depthWrite).toBe(true);
    disposeModelMaterials(clone);
    source.geometry.dispose();
    glass.dispose();
  }
});
