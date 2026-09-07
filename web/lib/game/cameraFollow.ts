type Position = { x: number; y: number; z: number };

export function createCameraFollow() {
  return { initialized: false, lastX: 0, lastZ: 0, leadX: 0, leadZ: 0, x: 0, y: 0, z: 0 };
}

/** Update at frame cadence so look-ahead settles even after movement ends. */
export function updateCameraFollow(state: ReturnType<typeof createCameraFollow>, position: Position, delta: number): boolean {
  const dt = Math.min(Math.max(delta, 0), 0.1);
  const vx = state.initialized && dt > 0 ? (position.x - state.lastX) / dt : 0;
  const vz = state.initialized && dt > 0 ? (position.z - state.lastZ) / dt : 0;
  const speed = Math.hypot(vx, vz);
  const lead = speed > 1 ? 1.2 / speed : 0;
  const blend = 1 - Math.exp(-3 * dt);
  state.leadX += (vx * lead - state.leadX) * blend;
  state.leadZ += (vz * lead - state.leadZ) * blend;
  if (Math.abs(state.leadX) < 0.0001) state.leadX = 0;
  if (Math.abs(state.leadZ) < 0.0001) state.leadZ = 0;
  const x = position.x + state.leadX, y = position.y + 1.5, z = position.z + state.leadZ;
  const changed = !state.initialized || Math.abs(x - state.x) + Math.abs(y - state.y) + Math.abs(z - state.z) > 0.00001;
  state.lastX = position.x;
  state.lastZ = position.z;
  state.initialized = true;
  if (changed) { state.x = x; state.y = y; state.z = z; }
  return changed;
}
