/**
 * HQ's aquarium fish (specs/interiors/hq.md: "instanced, cheaply animated fish"). Schools of silver fish through the
 * whole two storeys of water (the colour reference) and a scatter of small orange fish round the reef low down (the
 * size reference). Every fish swims a closed path the GPU works out from the time alone, so the tank costs one draw
 * and no work a frame beyond a uniform (components/game/hq/Aquarium.tsx does the same sums in its vertex shader):
 *
 *   z(t) = zc + za sin(w t + ph)          along the tank and back
 *   y(t) = y0 + ya sin(2 w t + 1.7 ph)    a gentle rise and fall
 *   x(t) = x0 + xa sin(1.3 w t + 0.6 ph)  toward the glass and away
 *
 * and faces the way it's going (yaw = atan2(dx/dt, dz/dt)). A school is fish on one path, strung out along it.
 */
import { HQ, type HqOption } from "./hqLayout";

export interface Fish {
  zc: number; za: number; w: number; ph: number;
  y0: number; ya: number; x0: number; xa: number;
  /** Its length; the tail's beat offset. */
  size: number; beat: number;
  color: string;
}

export const SILVER = ["#dfe7ea", "#c9d6dd", "#eef2f2", "#b9c9d2"] as const;
export const ORANGE = ["#f28a3a", "#f7a54d", "#ec7430", "#f9b85a"] as const;

/** The water the fish keep to: the tank's inside, kept off the glass, the back wall, the sand and the surface. */
export function swimBox(o: HqOption = HQ) {
  const a = o.aquarium;
  return { x0: a.x0 + 0.2, x1: a.x1 - 0.3, y0: a.y0 + 0.45, y1: a.y1 - 0.4, z0: a.z0 + 0.4, z1: a.z1 - 0.4 };
}

/** A seeded uniform in [0, 1) (mulberry32): the same tank every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function tankFish(o: HqOption = HQ, seed = 7): Fish[] {
  const r = rng(seed), box = swimBox(o), out: Fish[] = [];
  const zMid = (box.z0 + box.z1) / 2, zHalf = (box.z1 - box.z0) / 2, xMid = (box.x0 + box.x1) / 2, xHalf = (box.x1 - box.x0) / 2;
  // Four schools of silver, one above the other, each the length of the tank and back at its own pace.
  const schools = [{ y: 5.2, n: 12 }, { y: 4.0, n: 14 }, { y: 2.8, n: 12 }, { y: 1.7, n: 10 }];
  schools.forEach((s, k) => {
    const w = 0.1 + 0.05 * r(), ph = r() * Math.PI * 2, za = zHalf * (0.72 + 0.2 * r());
    const zc = zMid + (zHalf - za) * (r() * 2 - 1);
    for (let i = 0; i < s.n; i++) {
      const ya = 0.08 + 0.1 * r(), xa = Math.min(0.1, xHalf * 0.3);
      out.push({
        zc, za, w, ph: ph - i * 0.045 - r() * 0.03,
        y0: clamp(s.y + (r() * 2 - 1) * 0.45, box.y0 + ya, box.y1 - ya), ya,
        x0: clamp(xMid + (r() * 2 - 1) * xHalf * 0.6, box.x0 + xa, box.x1 - xa), xa,
        size: 0.3 + 0.12 * r(), beat: r() * 6.28, color: SILVER[(k + i) % SILVER.length],
      });
    }
  });
  // Orange fish about the reef, low down: short beats back and forth, quicker.
  for (let i = 0; i < 16; i++) {
    const za = 0.35 + 0.9 * r(), ya = 0.1 + 0.15 * r(), xa = Math.min(0.15, xHalf * 0.4);
    out.push({
      zc: clamp(box.z0 + r() * (box.z1 - box.z0), box.z0 + za, box.z1 - za), za, w: 0.35 + 0.3 * r(), ph: r() * Math.PI * 2,
      y0: clamp(box.y0 + 0.2 + r() * 1.9, box.y0 + ya, box.y1 - ya), ya,
      x0: clamp(xMid + (r() * 2 - 1) * xHalf * 0.5, box.x0 + xa, box.x1 - xa), xa,
      size: 0.13 + 0.06 * r(), beat: r() * 6.28, color: ORANGE[i % ORANGE.length],
    });
  }
  return out;
}

/** Where a fish is at time t (seconds) and which way it faces: the vertex shader's sums. */
export function fishAt(f: Fish, t: number): { x: number; y: number; z: number; yaw: number } {
  const a = f.w * t + f.ph, b = 1.3 * f.w * t + 0.6 * f.ph;
  const dz = f.za * f.w * Math.cos(a), dx = f.xa * 1.3 * f.w * Math.cos(b);
  return { x: f.x0 + f.xa * Math.sin(b), y: f.y0 + f.ya * Math.sin(2 * f.w * t + 1.7 * f.ph), z: f.zc + f.za * Math.sin(a), yaw: Math.atan2(dx, dz) };
}
