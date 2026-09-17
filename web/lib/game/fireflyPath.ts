/** Independent, smoothly eased waypoints around a planting anchor. */
export function fireflyOffset(seed: number, seconds: number): [number, number, number] {
  const random = (step: number, channel: number) => {
    const n = Math.sin(seed * 127.1 + step * 311.7 + channel * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const duration = 3.5 + random(0, 4) * 3;
  const time = seconds / duration + random(0, 5) * 10;
  const step = Math.floor(time), t = time - step;
  const blend = t * t * (3 - 2 * t);
  const point = (n: number): [number, number, number] => {
    const angle = random(n, 0) * Math.PI * 2, radius = Math.sqrt(random(n, 1)) * 1.4;
    return [Math.cos(angle) * radius, 0.3 + random(n, 2) * 0.8, Math.sin(angle) * radius];
  };
  const a = point(step), b = point(step + 1);
  return a.map((v, i) => v + (b[i] - v) * blend) as [number, number, number];
}
