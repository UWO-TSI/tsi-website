import * as THREE from "three";

/**
 * Returns the camera's forward direction projected onto the XZ plane
 * (Y stripped, normalized). Used by PlayerAvatar to translate raw WASD
 * input into camera-relative world motion.
 *
 * "Forward" = away from camera, into the scene.
 */
const _dir = new THREE.Vector3(), _out = { fx: 0, fz: 1 };
/** The result is shared scratch (the avatar calls this every frame): read it before the next call. */
export function getCameraForwardXZ(camera: THREE.Camera): { fx: number; fz: number } {
  camera.getWorldDirection(_dir);
  _dir.y = 0;
  if (_dir.lengthSq() < 1e-6) { _out.fx = 0; _out.fz = 1; return _out; }
  _dir.normalize();
  _out.fx = _dir.x; _out.fz = _dir.z;
  return _out;
}
