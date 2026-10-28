/**
 * A dig spot's mark (m3), as plain geometry lying flat on the ground (components/game/peaceful/VillageLife.tsx DigSpot).
 * David 2026-10-28: "should be way more subtle and small and lower opacity", "should look natural and hard to find
 * usually". On sand, a little star of hairline cracks a hand across; on dirt, a scuff of turned earth with a crumb or
 * two beside it, the kind of patch you walk past. Seeded, so each spot has its own.
 */
import * as THREE from "three";
import { hash01 } from "./worldFx";

const flat = (pts: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  // Wound either way round: drawn from both sides, lit as if facing up.
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pts.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
};

/** Sand: five thin arms of seeded length and bend from a little hub, about a hand across. */
export function crackStar(seed: number): THREE.BufferGeometry {
  const pts: number[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + (hash01(seed, k) - 0.5) * 0.7, len = 0.12 + hash01(seed, k + 9) * 0.08, w = 0.018;
    const bend = (hash01(seed, k + 19) - 0.5) * 0.5, mid = len * 0.55;
    const ax = Math.cos(a), az = Math.sin(a), px = -az, pz = ax;
    const mx = ax * mid + px * bend * 0.05, mz = az * mid + pz * bend * 0.05;
    // hub to the bend (a wedge), then the bend to the tip (a thinner one)
    pts.push(px * w, 0, pz * w, mx + px * w * 0.6, 0, mz + pz * w * 0.6, -px * w, 0, -pz * w);
    pts.push(-px * w, 0, -pz * w, mx + px * w * 0.6, 0, mz + pz * w * 0.6, mx - px * w * 0.6, 0, mz - pz * w * 0.6);
    pts.push(mx - px * w * 0.6, 0, mz - pz * w * 0.6, mx + px * w * 0.6, 0, mz + pz * w * 0.6, ax * len, 0, az * len);
  }
  return flat(pts);
}

/** Dirt: a lumpy scuff of turned earth (a seeded wobbling disc) and two crumbs beside it. */
export function soilScuff(seed: number): THREE.BufferGeometry {
  const pts: number[] = [];
  const blob = (cx: number, cz: number, r: number, n: number, salt: number) => {
    const at = (k: number) => {
      const a = (k / n) * Math.PI * 2, rr = r * (0.7 + hash01(seed, salt + (k % n)) * 0.5);
      return [cx + Math.cos(a) * rr * 1.25, cz + Math.sin(a) * rr] as const;
    };
    for (let k = 0; k < n; k++) {
      const [x0, z0] = at(k), [x1, z1] = at(k + 1);
      pts.push(cx, 0, cz, x0, 0, z0, x1, 0, z1);
    }
  };
  blob(0, 0, 0.13, 9, 0);
  for (let c = 0; c < 2; c++) {
    const a = hash01(seed, 40 + c) * Math.PI * 2, d = 0.22 + hash01(seed, 50 + c) * 0.08;
    blob(Math.cos(a) * d, Math.sin(a) * d, 0.025 + hash01(seed, 60 + c) * 0.015, 5, 70 + c * 10);
  }
  return flat(pts);
}
