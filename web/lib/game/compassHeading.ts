/** The minimap's north is +Z; east is +X. A vertical view has no horizontal heading. */
export function forwardAzimuth(x: number, z: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z) || x * x + z * z < 1e-12) return null;
  return Math.atan2(x, z);
}

export function compassDegrees(radians: number): number | null {
  if (!Number.isFinite(radians)) return null;
  return (((radians * 180) / Math.PI) % 360 + 360) % 360;
}

export function cardinalOffset(cardinal: number, heading: number): number {
  return ((cardinal - heading + 180) % 360 + 360) % 360 - 180;
}
