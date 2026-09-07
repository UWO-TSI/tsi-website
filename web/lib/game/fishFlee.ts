export interface FishSplash { id: number; x: number; z: number }
export interface FleeState { seenId: number; active: boolean; start: number; dx: number; dz: number }

export function makeFleeState(): FleeState {
  return { seenId: 0, active: false, start: 0, dx: 0, dz: 0 };
}

/** Decide range once per landing, then dart outward and drift back to the patrol. */
export function computeFlee(fs: FleeState, splash: FishSplash, fx: number, fz: number, now: number) {
  if (fs.seenId !== splash.id) {
    fs.seenId = splash.id;
    const dx = fx - splash.x, dz = fz - splash.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 6) {
      fs.active = true;
      fs.start = now;
      fs.dx = distance > 0.01 ? dx / distance : 1;
      fs.dz = distance > 0.01 ? dz / distance : 0;
    }
  }
  if (!fs.active) return { ox: 0, oz: 0, dart: false };
  const progress = Math.max(0, (now - fs.start) / 2800);
  if (progress >= 1) {
    fs.active = false;
    return { ox: 0, oz: 0, dart: false };
  }
  const outward = progress < 0.3 ? 1 - (1 - progress / 0.3) ** 3 : 1 - (progress - 0.3) / 0.7;
  return { ox: fs.dx * 2.6 * outward, oz: fs.dz * 2.6 * outward, dart: progress < 0.3 };
}
