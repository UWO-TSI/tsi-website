/**
 * A dig spot's mark (m3): a star of five cracks lying flat on the ground, as plain geometry (components/game/peaceful/
 * VillageLife.tsx DigSpot). Seeded, so each spot has its own star.
 */
import * as THREE from "three";
import { hash01 } from "./worldFx";

/** One star: five arms of seeded length and bend, each a wedge from a little hub, lying flat (normal up). */
export function crackStar(seed: number): THREE.BufferGeometry {
  const pts: number[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + (hash01(seed, k) - 0.5) * 0.7, len = 0.34 + hash01(seed, k + 9) * 0.22, w = 0.06;
    const bend = (hash01(seed, k + 19) - 0.5) * 0.5, mid = len * 0.55;
    const ax = Math.cos(a), az = Math.sin(a), px = -az, pz = ax;
    const mx = ax * mid + px * bend * 0.12, mz = az * mid + pz * bend * 0.12;
    // hub to the bend (a wedge), then the bend to the tip (a thinner one)
    pts.push(px * w, 0, pz * w, mx + px * w * 0.6, 0, mz + pz * w * 0.6, -px * w, 0, -pz * w);
    pts.push(-px * w, 0, -pz * w, mx + px * w * 0.6, 0, mz + pz * w * 0.6, mx - px * w * 0.6, 0, mz - pz * w * 0.6);
    pts.push(mx - px * w * 0.6, 0, mz - pz * w * 0.6, mx + px * w * 0.6, 0, mz + pz * w * 0.6, ax * len, 0, az * len);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  // Wound either way round: drawn from both sides, lit as if facing up.
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pts.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}
