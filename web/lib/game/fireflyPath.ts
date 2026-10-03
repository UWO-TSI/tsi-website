/** The path's pseudo-random channel for a seed, a waypoint step and a channel, in [0, 1). */
function random(seed: number, step: number, channel: number) {
  const n = Math.sin(seed * 127.1 + step * 311.7 + channel * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Independent, smoothly eased waypoints around a planting anchor, into `out` (nothing allocated: the auras move a
 * few dozen motes a frame for every player in view).
 */
export function fireflyOffsetInto<T extends { [i: number]: number }>(seed: number, seconds: number, out: T): T {
  const duration = 3.5 + random(seed, 0, 4) * 3;
  const time = seconds / duration + random(seed, 0, 5) * 10;
  const step = Math.floor(time), t = time - step;
  const blend = t * t * (3 - 2 * t);
  const a = random(seed, step, 0) * Math.PI * 2, ar = Math.sqrt(random(seed, step, 1)) * 1.4, ay = 0.3 + random(seed, step, 2) * 0.8;
  const b = random(seed, step + 1, 0) * Math.PI * 2, br = Math.sqrt(random(seed, step + 1, 1)) * 1.4, by = 0.3 + random(seed, step + 1, 2) * 0.8;
  const ax = Math.cos(a) * ar, az = Math.sin(a) * ar, bx = Math.cos(b) * br, bz = Math.sin(b) * br;
  out[0] = ax + (bx - ax) * blend;
  out[1] = ay + (by - ay) * blend;
  out[2] = az + (bz - az) * blend;
  return out;
}

/** Independent, smoothly eased waypoints around a planting anchor. */
export function fireflyOffset(seed: number, seconds: number): [number, number, number] {
  return fireflyOffsetInto(seed, seconds, [0, 0, 0]);
}
