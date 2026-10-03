/**
 * Where a donated fish is in its museum tank (specs/polish/interiors.md deliverable 4): an easy lap low and near the
 * front glass (the tank's lid hides its middle from the follow camera), each fish its own pace, direction and phase
 * from its seed, on the shared world clock so everyone sees the same aquarium. Sea creatures keep to the floor and
 * shuffle. Tank space: museum-tank.glb at the museum's 0.27 (x +-0.92, z +-0.57, glass at -z, the water 0.3 to 1.7).
 */
export const TANK = { cx: 0, cz: -0.14, rx: 0.42, rz: 0.12, y: 0.7, bob: 0.06, floor: 0.42 };

export interface SwimPose { x: number; y: number; z: number; yaw: number; wag: number }

/** A fish's length in the tank from its real size (cm): small fry about a quarter unit, the giants capped to fit. */
export function tankLength(sizeCm: readonly [number, number]): number {
  const cm = (sizeCm[0] + sizeCm[1]) / 2;
  return Math.min(0.5, Math.max(0.22, 0.22 + 0.1 * Math.log2(Math.max(1, cm) / 10)));
}

/** The fish's pose at world time `t`; `speed` from its species' move (0.1 to 0.45), `creature` keeps to the floor. */
export function tankSwim(t: number, seed: number, speed: number, creature: boolean, out: SwimPose): SwimPose {
  const dir = seed % 2 ? 1 : -1, phase = (seed % 997) / 997 * Math.PI * 2;
  if (creature) {
    // Along the front of the floor and back, sideways like a crab, pausing at each end (the sine's flats).
    const s = Math.sin(t * (0.25 + speed) + phase);
    out.x = TANK.cx + 0.32 * Math.sign(s) * Math.min(1, Math.abs(s) * 1.4);
    out.y = TANK.floor; out.z = TANK.cz - 0.06; out.yaw = Math.PI / 2 * dir; out.wag = 0;
    return out;
  }
  const w = (0.55 + speed * 1.4) * dir, a = t * w + phase;
  out.x = TANK.cx + TANK.rx * Math.cos(a);
  out.z = TANK.cz + TANK.rz * Math.sin(a);
  out.y = TANK.y + TANK.bob * Math.sin(a * 2 + phase);
  // Facing along the lap (its tangent), the tail beating faster the quicker it goes.
  out.yaw = Math.atan2(-TANK.rx * Math.sin(a) * w, TANK.rz * Math.cos(a) * w);
  out.wag = 0.2 * Math.sin(t * (6 + speed * 10) + phase);
  return out;
}
