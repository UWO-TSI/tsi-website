import * as THREE from "three";

/**
 * The rod's tip in the model's own space (the blank runs up +y from the grip, art/props-enemies/build_tools.py): its
 * highest point. From the meshes' own transforms up to the model, not the world's (it pops in from scale 0).
 */
export function rodTip(model: THREE.Object3D): THREE.Vector3 {
  const tip = new THREE.Vector3(0, 0.7, 0), v = new THREE.Vector3(), rel = new THREE.Matrix4();
  let best = -Infinity;
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    rel.identity();
    for (let n: THREE.Object3D | null = m; n && n !== model; n = n.parent) { n.updateMatrix(); rel.premultiply(n.matrix); }
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(rel);
      if (v.y > best) { best = v.y; tip.copy(v); }
    }
  });
  return tip;
}
