/**
 * The effects library's code-drawn types (lib/game/fx/library.ts): `glow` on a whole model, lit from within in a
 * colour, and `sparks`, a one-off spray off it into the scene's glow pool. No discs, no rings: the light is the
 * model's own shape.
 */
import * as THREE from "three";
import { FACE, type Recipe } from "./particles";
import { FX, fxAt } from "./library";

/**
 * Light `root`'s own lit parts (not its effect's, `userData.fx`) from within: `colour` times `amount` over what each
 * already gives off. `lit` remembers each material's own glow, so `amount` 0 puts it back exactly. Each frame.
 */
export function glowOn(root: THREE.Object3D, colour: THREE.Color, amount: number, lit: Map<THREE.MeshStandardMaterial, THREE.Color>) {
  root.traverse(o => {
    const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshStandardMaterial;
    if (!mesh.isMesh || mesh.userData.fx || !m.isMeshStandardMaterial) return;
    if (!lit.has(m)) lit.set(m, m.emissive.clone().multiplyScalar(m.emissiveIntensity));
    m.emissive.copy(colour).multiplyScalar(amount).add(lit.get(m)!);
    m.emissiveIntensity = 1;
  });
}

/** The `sparks` type's recipe at strength `k`: glowing sparks flung every way, slowing and fading. */
export function sparkRecipe(k = 1): Recipe<string> {
  const n = fxAt("sparks", "count", k), v = FX.sparks.params.speed.value, life = FX.sparks.params.life.value;
  return { sprite: "sparkle", count: [Math.round(n * 0.8), Math.round(n * 1.2)], life: [life * 0.7, life * 1.2], size: [0.035, 0.07], grow: 0.2,
    speed: [v * 0.5, v], spread: Math.PI, up: [-v * 0.4, v * 0.8], gravity: 0, drag: 2.2, wind: 0, alpha: 1, face: FACE.billboard, jitter: 0.08 };
}
