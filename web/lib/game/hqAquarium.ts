/**
 * HQ's aquarium fish (specs/interiors/hq.md: "instanced, cheaply animated fish"). Schools of silver fish through the
 * whole two storeys of water (the colour reference) and a scatter of small orange fish round the reef low down (the
 * size reference). The tank fills the back wall, so the fish swim along x, and toward the glass (−z) and away. Every
 * fish swims a closed path the GPU works out from the time alone, so the tank costs one draw and no work a frame beyond
 * a uniform (components/game/hq/Aquarium.tsx does the same sums in its vertex shader):
 *
 *   x(t) = ac + aa sin(w t + ph)          along the tank and back
 *   y(t) = y0 + ya sin(2 w t + 1.7 ph)    a gentle rise and fall
 *   z(t) = d0 + da sin(1.3 w t + 0.6 ph)  toward the glass and away
 *
 * and faces the way it's going (yaw = atan2(dx/dt, dz/dt)). A school is fish on one path, strung out along it.
 */
import * as THREE from "three";
import { HQ, type HqOption } from "./hqLayout";
import { seededRandom } from "./weatherSystem";

export interface Fish {
  /** Along the tank (x): the middle and the reach of its run. */
  ac: number; aa: number; w: number; ph: number;
  y0: number; ya: number;
  /** Its depth (z): the middle and the reach toward the glass and back. */
  d0: number; da: number;
  /** Its length; the tail's beat offset. */
  size: number; beat: number;
  color: string;
}

export const SILVER = ["#dfe7ea", "#c9d6dd", "#eef2f2", "#b9c9d2"] as const;
export const ORANGE = ["#f28a3a", "#f7a54d", "#ec7430", "#f9b85a"] as const;

/** The water the fish keep to: the tank's inside, kept off the glass, the back wall, the ends, the sand and the surface. */
export function swimBox(o: HqOption = HQ) {
  const a = o.aquarium;
  return { x0: a.x0 + 0.4, x1: a.x1 - 0.4, y0: a.y0 + 0.45, y1: a.y1 - 0.4, z0: a.z0 + 0.2, z1: a.z1 - 0.3 };
}

export function tankFish(o: HqOption = HQ, seed = 7): Fish[] {
  const r = seededRandom(seed), box = swimBox(o), out: Fish[] = [];
  const aMid = (box.x0 + box.x1) / 2, aHalf = (box.x1 - box.x0) / 2, dMid = (box.z0 + box.z1) / 2, dHalf = (box.z1 - box.z0) / 2;
  // Five schools of silver, one above the other up the two storeys, each the length of the tank and back at its own pace.
  const schools = [{ y: 7.5, n: 11 }, { y: 6.1, n: 12 }, { y: 4.7, n: 12 }, { y: 3.3, n: 11 }, { y: 1.9, n: 9 }];
  schools.forEach((s, k) => {
    const w = 0.1 + 0.05 * r(), ph = r() * Math.PI * 2, aa = aHalf * (0.72 + 0.2 * r());
    const ac = aMid + (aHalf - aa) * (r() * 2 - 1);
    for (let i = 0; i < s.n; i++) {
      const ya = 0.08 + 0.1 * r(), da = Math.min(0.1, dHalf * 0.3);
      out.push({
        ac, aa, w, ph: ph - i * 0.045 - r() * 0.03,
        y0: THREE.MathUtils.clamp(s.y + (r() * 2 - 1) * 0.45, box.y0 + ya, box.y1 - ya), ya,
        d0: THREE.MathUtils.clamp(dMid + (r() * 2 - 1) * dHalf * 0.6, box.z0 + da, box.z1 - da), da,
        size: 0.3 + 0.12 * r(), beat: r() * 6.28, color: SILVER[(k + i) % SILVER.length],
      });
    }
  });
  // Orange fish about the reef, low down: short beats back and forth, quicker.
  for (let i = 0; i < 20; i++) {
    const aa = 0.35 + 0.9 * r(), ya = 0.1 + 0.15 * r(), da = Math.min(0.15, dHalf * 0.4);
    out.push({
      ac: THREE.MathUtils.clamp(box.x0 + r() * (box.x1 - box.x0), box.x0 + aa, box.x1 - aa), aa, w: 0.35 + 0.3 * r(), ph: r() * Math.PI * 2,
      y0: THREE.MathUtils.clamp(box.y0 + 0.2 + r() * 1.9, box.y0 + ya, box.y1 - ya), ya,
      d0: THREE.MathUtils.clamp(dMid + (r() * 2 - 1) * dHalf * 0.5, box.z0 + da, box.z1 - da), da,
      size: 0.13 + 0.06 * r(), beat: r() * 6.28, color: ORANGE[i % ORANGE.length],
    });
  }
  return out;
}

/** Where a fish is at time t (seconds) and which way it faces: the vertex shader's sums. */
export function fishAt(f: Fish, t: number): { x: number; y: number; z: number; yaw: number } {
  const a = f.w * t + f.ph, b = 1.3 * f.w * t + 0.6 * f.ph;
  const dx = f.aa * f.w * Math.cos(a), dz = f.da * 1.3 * f.w * Math.cos(b);
  return { x: f.ac + f.aa * Math.sin(a), y: f.y0 + f.ya * Math.sin(2 * f.w * t + 1.7 * f.ph), z: f.d0 + f.da * Math.sin(b), yaw: Math.atan2(dx, dz) };
}
