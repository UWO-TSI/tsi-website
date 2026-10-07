/** One firefly's smooth random draw (the same numbers the path has always used), at module scope: no closure per call. */
function rnd(seed: number, step: number, channel: number): number {
  const n = Math.sin(seed * 127.1 + step * 311.7 + channel * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Independent, smoothly eased waypoints around a planting anchor, written into `out` at `at` (x, y, z) and that same
 * array handed back: the swarm's frame loop allocates nothing (specs/polish/forage-craft-museum.md 5).
 */
export function fireflyOffsetInto<T extends { [i: number]: number }>(seed: number, seconds: number, out: T, at = 0): T {
  const duration = 3.5 + rnd(seed, 0, 4) * 3;
  const time = seconds / duration + rnd(seed, 0, 5) * 10;
  const step = Math.floor(time), t = time - step;
  const blend = t * t * (3 - 2 * t);
  const a0 = rnd(seed, step, 0) * Math.PI * 2, r0 = Math.sqrt(rnd(seed, step, 1)) * 1.4, y0 = 0.3 + rnd(seed, step, 2) * 0.8;
  const a1 = rnd(seed, step + 1, 0) * Math.PI * 2, r1 = Math.sqrt(rnd(seed, step + 1, 1)) * 1.4, y1 = 0.3 + rnd(seed, step + 1, 2) * 0.8;
  const x0 = Math.cos(a0) * r0, z0 = Math.sin(a0) * r0, x1 = Math.cos(a1) * r1, z1 = Math.sin(a1) * r1;
  out[at] = x0 + (x1 - x0) * blend;
  out[at + 1] = y0 + (y1 - y0) * blend;
  out[at + 2] = z0 + (z1 - z0) * blend;
  return out;
}

/** Independent, smoothly eased waypoints around a planting anchor (a new array: tests and one-off reads). */
export function fireflyOffset(seed: number, seconds: number): [number, number, number] {
  return fireflyOffsetInto(seed, seconds, [0, 0, 0] as [number, number, number]);
}
