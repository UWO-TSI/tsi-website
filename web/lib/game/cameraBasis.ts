import * as THREE from "three";

/**
 * Returns the camera's forward direction projected onto the XZ plane
 * (Y stripped, normalized). Used by PlayerAvatar to translate raw WASD
 * input into camera-relative world motion.
 *
 * "Forward" = away from camera, into the scene.
 */
export function getCameraForwardXZ(camera: THREE.Camera): { fx: number; fz: number } {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return { fx: 0, fz: 1 };
  dir.normalize();
  return { fx: dir.x, fz: dir.z };
}
