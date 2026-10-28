import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { mergeByLook } from "./InstancedNature";

/** A model of two parts: a casting box and a box that only receives, in different looks. */
function model() {
  const root = new THREE.Group();
  const cast = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "wood" }));
  cast.castShadow = true;
  const flat = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: "cloth" }));
  root.add(cast, flat);
  return root;
}
const at = (x: number, z: number) => new THREE.Matrix4().makeTranslation(x, 0, z);
const tris = (m: THREE.Mesh) => m.geometry.index!.count / 3;

describe("mergeByLook parts (MergedModels cull)", () => {
  const m = model();
  const placed = [[m, at(1, 1)], [m, at(5, 2)], [m, at(40, 1)]] as const;

  it("joins one mesh per look across the world, casting as each part does", () => {
    const meshes = mergeByLook(placed);
    expect(meshes.map(x => [x.castShadow, tris(x)])).toEqual([[true, 36], [false, 36]]);
  });

  it("joins the view per block, none of it casting", () => {
    const view = mergeByLook(placed, undefined, { view: 32 });
    expect(view).toHaveLength(4);
    expect(view.every(x => !x.castShadow && x.visible && x.receiveShadow)).toBe(true);
    expect(view.map(tris).sort()).toEqual([12, 12, 24, 24]);
  });

  it("keeps every casting part in one caster drawn in the shadow passes alone", () => {
    const [caster, ...rest] = mergeByLook(placed, undefined, "caster");
    expect(rest).toHaveLength(0);
    expect(tris(caster)).toBe(36);
    expect([caster.castShadow, caster.visible, caster.userData.casterOnly]).toEqual([true, false, true]);
  });
});
