import { expect, it, vi } from "vitest";
import { BoxGeometry, Frustum, Group, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Texture, Vector3 } from "three";
import { disposeModelMaterials, prepareModel } from "./modelMaterials";
import { bendViewPoint } from "./worldProjection";

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
