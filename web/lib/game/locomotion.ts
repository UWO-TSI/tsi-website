/** Exact displacement while velocity eases toward a constant target. */
export function advanceVelocity(velocity: number, target: number, response: number, delta: number): [number, number] {
  if (delta <= 0) return [velocity, 0];
  const decay = Math.exp(-response * delta);
  return [target + (velocity - target) * decay, target * delta + (velocity - target) * (1 - decay) / response];
}

/** Turn through the shortest arc, including across the -π/+π seam. */
export function easeFacing(angle: number, target: number, response: number, delta: number): number {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + difference * (1 - Math.exp(-response * Math.max(0, delta)));
}

export interface PlanarMotion { x: number; z: number; vx: number; vz: number }
export interface MotionIntent {
  x: number;
  z: number;
  speed: number;
  response: number;
  goal?: { x: number; z: number };
}

/** Shared keyboard/tap movement; collisions constrain the proposed path before feedback. */
export function advanceMotion(state: PlanarMotion, intent: MotionIntent, delta: number,
  constrain: (x: number, z: number, nextX: number, nextZ: number) => [number, number]) {
  const goalDistance = intent.goal ? Math.hypot(intent.goal.x - state.x, intent.goal.z - state.z) : Infinity;
  const speed = Math.min(intent.speed, goalDistance * 4);
  let [vx, moveX] = advanceVelocity(state.vx, intent.x * speed, intent.response, delta);
  let [vz, moveZ] = advanceVelocity(state.vz, intent.z * speed, intent.response, delta);
  if (goalDistance <= 0.1) { vx = 0; vz = 0; moveX = 0; moveZ = 0; }
  const reachesGoal = !!intent.goal && Math.hypot(moveX, moveZ) >= goalDistance;
  const nextX = reachesGoal ? intent.goal!.x : state.x + moveX;
  const nextZ = reachesGoal ? intent.goal!.z : state.z + moveZ;
  const [x, z] = constrain(state.x, state.z, nextX, nextZ);
  if (delta > 0) {
    if (Math.abs(x - nextX) > 0.0001) vx = (x - state.x) / delta;
    if (Math.abs(z - nextZ) > 0.0001) vz = (z - state.z) / delta;
  }
  const arrived = !!intent.goal && Math.hypot(intent.goal.x - x, intent.goal.z - z) <= 0.1;
  if (arrived) { vx = 0; vz = 0; }
  return { x, z, vx, vz, arrived, moving: Math.hypot(x - state.x, z - state.z) > 0.02 * delta };
}

/** Sprite sheets face the viewer; world heading must be relative to the camera. */
export function relativeFacingAngle(worldAngle: number, cameraForwardX: number, cameraForwardZ: number): number {
  const x = Math.sin(worldAngle), z = Math.cos(worldAngle);
  const forward = x * cameraForwardX + z * cameraForwardZ;
  const right = -x * cameraForwardZ + z * cameraForwardX;
  return Math.atan2(-right, forward);
}
