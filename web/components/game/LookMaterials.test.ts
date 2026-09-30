import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { materialSummary, sweepScene } from "./LookMaterials";

describe("LookMaterials", () => {
  it("forgets materials that left the scene, so disposed ones are not kept or walked", () => {
    const scene = new THREE.Scene();
    const kept = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const gone = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    scene.add(kept, gone);
    sweepScene(scene);
    expect(materialSummary().props.count).toBe(2);
    scene.remove(gone);
    gone.material.dispose();
    sweepScene(scene);
    expect(materialSummary().props.count).toBe(1);
  });
});
