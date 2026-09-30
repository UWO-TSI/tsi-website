import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addContact, ContactLayer } from "./ContactShadows";

const drawn = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse(m => { if ((m as THREE.InstancedMesh).isInstancedMesh) n += (m as THREE.InstancedMesh).count; });
  return n;
};

describe("contact shadow layer", () => {
  it("draws every registered contact, past the first 1024 (a bigger painted island)", () => {
    const scene = new THREE.Scene(), layer = new ContactLayer();
    const size = { cx: 0, cz: 0, rx: 0.5, rz: 0.5, height: 0, strength: 1 };
    for (let i = 0; i < 1500; i++) {
      const o = new THREE.Object3D();
      o.position.set(i % 40, 0, Math.floor(i / 40));
      scene.add(o);
      addContact(scene, o, size);
    }
    scene.updateMatrixWorld();
    layer.look("#000000", 1, true);
    const unhook = layer.hook(scene);
    scene.onBeforeRender({} as THREE.WebGLRenderer, scene, new THREE.Camera(), null as never, null as never, null as never);
    expect(drawn(layer.contacts)).toBe(1500);
    unhook();
  });
});
