import { expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { disposeModelMaterials, prepareModel } from "./modelMaterials";

it("keeps source materials intact and disposes only the instance's shared clones", () => {
  const material = new MeshStandardMaterial({ name: "mTreeOakLeaf" });
  const geometry = new BoxGeometry();
  const source = new Group();
  source.add(new Mesh(geometry, material), new Mesh(geometry, material));
  const originalDispose = vi.spyOn(material, "dispose");
  const geometryDispose = vi.spyOn(geometry, "dispose");
  const clone = prepareModel(source, "/assets/acnh/plants/tree-hardwood-a.glb", true);
  const first = clone.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>;
  const second = clone.children[1] as Mesh<BoxGeometry, MeshStandardMaterial>;
  expect(first.material).not.toBe(material);
  expect(first.material).toBe(second.material);
  expect(material.color.getHex()).toBe(0xffffff);
  expect(first.material.color.g).toBeGreaterThan(first.material.color.r);
  const cloneDispose = vi.spyOn(first.material, "dispose");
  disposeModelMaterials(clone);
  expect(cloneDispose).toHaveBeenCalledOnce();
  expect(originalDispose).not.toHaveBeenCalled();
  expect(geometryDispose).not.toHaveBeenCalled();
});
