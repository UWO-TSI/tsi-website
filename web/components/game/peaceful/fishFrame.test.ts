// Every fish model is in the game's frame (head +y, back -z: art/remodel/build_fish.py, art/fish/build_meshy_fish.py);
// every view that lays one level must show it back up (fish-models round 4, David: "wh yare all the fish upside down").
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { levelFish } from "./TankFish";
import { previewFish } from "@/components/lab/FishPreview";

/** A stand-in fish in the game's frame: four marker vertices, the head, the tail, the dorsal fin's tip and the belly. */
function fakeFish() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 1, 0, 0, -1, 0, 0, 0, -0.4, 0, 0, 0.2], 3));
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
  return scene;
}
/** The four markers in world space. */
function markers(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  let mesh: THREE.Mesh | null = null;
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  const pos = mesh!.geometry.getAttribute("position");
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh!.matrixWorld);
  return { head: at(0), tail: at(1), dorsal: at(2), belly: at(3) };
}

describe("fish frame", () => {
  it("levelFish (the tank, the trophy case, the HQ aquarium, the icons) lays a fish head first along +z, back up", () => {
    const { head, tail, dorsal, belly } = markers(levelFish(fakeFish(), { model: "/fake.glb", raw: false }, 2));
    expect(head.z).toBeGreaterThan(tail.z);
    expect(dorsal.y).toBeGreaterThan(belly.y);
  });
  it("the fishing bench's preview shows it nose left, back up", () => {
    const { head, tail, dorsal, belly } = markers(previewFish(fakeFish(), "/fake.glb", false));
    expect(head.x).toBeLessThan(tail.x);
    expect(dorsal.y).toBeGreaterThan(belly.y);
  });
});
