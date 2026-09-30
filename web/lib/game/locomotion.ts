/** Turn through the shortest arc, including across the -π/+π seam. */
export function easeFacing(angle: number, target: number, response: number, delta: number): number {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + difference * (1 - Math.exp(-response * Math.max(0, delta)));
}
